import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Location } from './location.entity';
import { User } from './user.entity';
import { UuidBaseEntity } from './uuid-base.entity';

/** Optional warehouse/location scope for a user (e.g. Operations Manager → Dire Dawa). */
@Entity('user_locations')
@Unique(['userId', 'locationId'])
export class UserLocation extends UuidBaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => User, (user) => user.userLocations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
