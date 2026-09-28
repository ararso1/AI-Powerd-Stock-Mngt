import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';
import { DataSource, Repository } from 'typeorm';
import { BankTransactionType, PaymentMethod } from '../common/enums';
import {
  applyDateRangeToQb,
  applyRelatedIlikeSearch,
  paginatedQueryBuilder,
  sumFilteredQueryBuilder,
} from '../common/utils/query.util';
import { ExpenseListQueryDto } from './dto/expense-list-query.dto';
import { BankLedgerService } from '../banks/bank-ledger.service';
import { BanksService } from '../banks/banks.service';
import { ExpenseCategory } from '../database/entities/expense-category.entity';
import { Expense } from '../database/entities/expense.entity';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'expenses');
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export type ExpenseReceiptFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};
import {
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  UpdateExpenseDto,
} from './dto/expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(ExpenseCategory)
    private readonly categoryRepo: Repository<ExpenseCategory>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly bankLedger: BankLedgerService,
    private readonly banksService: BanksService,
  ) {}

  findCategories() {
    return this.categoryRepo.find({ order: { name: 'ASC' } });
  }

  createCategory(dto: CreateExpenseCategoryDto) {
    return this.categoryRepo.save(this.categoryRepo.create(dto));
  }

  async findAll(query: ExpenseListQueryDto) {
    const filteredQb = this.buildExpenseFilterQb(query);
    const [totals, page] = await Promise.all([
      sumFilteredQueryBuilder(filteredQb, [
        { key: 'amount', sql: 'COALESCE(SUM(expense.amount::numeric), 0)' },
      ]),
      paginatedQueryBuilder(
        filteredQb
          .clone()
          .leftJoinAndSelect('expense.category', 'category')
          .leftJoinAndSelect('expense.bankAccount', 'bankAccount')
          .orderBy('expense.expense_date', 'DESC'),
        query.page,
        query.limit,
      ),
    ]);

    return { ...page, totals };
  }

  private buildExpenseFilterQb(query: ExpenseListQueryDto) {
    const qb = this.expenseRepo.createQueryBuilder('expense');

    if (query.categoryId) {
      qb.andWhere('expense.category_id = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.bankAccountId) {
      qb.andWhere('expense.bank_account_id = :bankAccountId', {
        bankAccountId: query.bankAccountId,
      });
    }
    if (query.coffeeMarket === 'NONE') {
      qb.andWhere('expense.coffee_market IS NULL');
    } else if (query.coffeeMarket) {
      qb.andWhere('expense.coffee_market = :coffeeMarket', {
        coffeeMarket: query.coffeeMarket,
      });
    }
    applyRelatedIlikeSearch(qb, query.search, ['expense.description'], {
      table: 'expense_categories',
      alias: 'category_filter',
      parentKey: 'expense.category_id',
      relatedKey: 'id',
      columns: ['name'],
    });
    applyDateRangeToQb(qb, 'expense.expense_date', query.from, query.to);

    return qb;
  }

  async create(
    dto: CreateExpenseDto,
    userId?: string,
    receipt?: ExpenseReceiptFile,
  ) {
    const receiptMeta = this.prepareReceipt(receipt);
    const paymentMethod =
      dto.paymentMethod === 'CASH' ? PaymentMethod.CASH : PaymentMethod.BANK;

    let writtenKey: string | null = null;
    let expenseId: string;
    try {
      expenseId = await this.dataSource.transaction(async (manager) => {
      await this.banksService.assertPaymentAccount(
        paymentMethod,
        dto.bankAccountId,
        manager,
      );

      const expenseRepo = manager.getRepository(Expense);
      const expense = await expenseRepo.save(
        expenseRepo.create({
          categoryId: dto.categoryId,
          bankAccountId: dto.bankAccountId,
          paymentMethod: dto.paymentMethod,
          amount: dto.amount.toFixed(2),
          description: dto.description ?? null,
          expenseDate: dto.expenseDate,
          coffeeMarket: dto.coffeeMarket ?? null,
          createdById: userId ?? null,
          receiptOriginalName: receiptMeta?.originalName ?? null,
          receiptMimeType: receiptMeta?.mimeType ?? null,
          receiptStorageKey: receiptMeta?.storageKey ?? null,
        }),
      );

      if (receiptMeta) {
        mkdirSync(UPLOAD_ROOT, { recursive: true });
        writeFileSync(
          path.join(UPLOAD_ROOT, receiptMeta.storageKey),
          receiptMeta.buffer,
        );
        writtenKey = receiptMeta.storageKey;
      }

      await this.bankLedger.recordTransaction(
        {
          bankAccountId: dto.bankAccountId,
          type: BankTransactionType.EXPENSE,
          amount: dto.amount,
          direction: 'out',
          description: dto.description ?? `Expense ${expense.id}`,
          refType: 'expense',
          refId: expense.id,
          createdById: userId,
        },
        manager,
      );

      return expense.id;
    });
    } catch (err) {
      if (writtenKey) {
        const fullPath = path.join(UPLOAD_ROOT, writtenKey);
        if (existsSync(fullPath)) unlinkSync(fullPath);
      }
      throw err;
    }

    return this.expenseRepo.findOne({
      where: { id: expenseId },
      relations: { category: true, bankAccount: true },
    });
  }

  async receiptFile(id: string) {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (!expense.receiptStorageKey) {
      throw new NotFoundException('This expense has no receipt');
    }
    const fullPath = path.join(UPLOAD_ROOT, expense.receiptStorageKey);
    if (!existsSync(fullPath)) {
      throw new NotFoundException('Receipt file is missing');
    }
    return {
      stream: createReadStream(fullPath),
      mimeType: expense.receiptMimeType ?? 'application/octet-stream',
      originalName: expense.receiptOriginalName ?? 'receipt',
    };
  }

  async update(id: string, dto: UpdateExpenseDto) {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (dto.description !== undefined) expense.description = dto.description;
    if (dto.categoryId !== undefined) expense.categoryId = dto.categoryId;
    if (dto.coffeeMarket !== undefined) expense.coffeeMarket = dto.coffeeMarket;
    return this.expenseRepo.save(expense);
  }

  async remove(id: string, userId?: string) {
    await this.dataSource.transaction(async (manager) => {
      const expenseRepo = manager.getRepository(Expense);
      const expense = await expenseRepo.findOne({ where: { id } });
      if (!expense) throw new NotFoundException('Expense not found');

      await this.bankLedger.reverseByReference(
        'expense',
        id,
        `Reversal of expense ${id}`,
        userId,
        manager,
      );

      if (expense.receiptStorageKey) {
        const fullPath = path.join(UPLOAD_ROOT, expense.receiptStorageKey);
        if (existsSync(fullPath)) unlinkSync(fullPath);
      }

      await expenseRepo.remove(expense);
    });

    return { success: true };
  }

  private prepareReceipt(file?: ExpenseReceiptFile) {
    if (!file) return null;
    if (!file.buffer?.length) {
      throw new BadRequestException('Receipt file is empty');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Receipt must be JPEG, PNG, WebP, or PDF');
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      throw new BadRequestException('Receipt must be 10MB or smaller');
    }
    const ext = this.safeExt(file.originalname, file.mimetype);
    return {
      originalName: file.originalname.slice(0, 255),
      mimeType: file.mimetype,
      storageKey: `${randomUUID()}${ext}`,
      buffer: file.buffer,
    };
  }

  private safeExt(originalName: string, mime: string) {
    const fromName = path.extname(originalName || '').toLowerCase();
    if (fromName && /^\.(pdf|jpe?g|png|webp)$/.test(fromName)) return fromName;
    if (mime === 'application/pdf') return '.pdf';
    if (mime === 'image/jpeg') return '.jpg';
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    return '';
  }
}
