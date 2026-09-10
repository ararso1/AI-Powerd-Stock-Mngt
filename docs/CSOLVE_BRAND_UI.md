# Csolve brand & UI tokens

Canonical tokens live in `stock-frontend/app/globals.css`.

## Palette

Coffee **primary** stays roast brown. **Secondary** is coffee-leaf moss for contrast and freshness. **Honey** adds warmth for highlights without competing with primary actions.

| Token | Hex | Use |
|-------|-----|-----|
| `--csolve-espresso` | `#2F1B10` | Sidebar base, headings |
| `--csolve-roast` | `#6F4E37` | Primary actions, links |
| `--csolve-roast-hover` | `#5A3F2C` | Primary hover |
| `--csolve-bean` | `#8B5E3C` | Accents, chart series |
| `--csolve-caramel` | `#C4A484` | Soft warm accents |
| `--csolve-moss` | `#2F6B56` | **Secondary** actions, info, rings |
| `--csolve-moss-hover` | `#255645` | Secondary hover |
| `--csolve-moss-soft` | `#E4F0EA` | Secondary button / badge wash |
| `--csolve-leaf` | `#3F8F6B` | Success |
| `--csolve-honey` | `#D9A45A` | Highlights, active nav cue |
| `--csolve-honey-soft` | `#F8EFDC` | Accent wash / warning soft |
| `--csolve-cream` | `#F6F1E8` | App desk background |
| `--csolve-parchment` | `#FFFCF7` | Cards / surfaces |
| `--csolve-mist` | `#EEF3F0` | Cool desk wash (pairs with moss) |
| `--csolve-section` | `#EFE6D8` | Table headers, muted blocks |
| `--csolve-border` | `#E0D3C2` | Default borders |
| `--csolve-cherry` | `#B43C30` | Destructive / alerts |
| `--csolve-warn` | `#C47A28` | Warnings |

## Usage rules

1. **Primary buttons** → roast (`--frappe-primary`)  
2. **Secondary buttons** → moss soft fill + moss text (`csolve-btn-secondary`)  
3. **Success / QC pass** → leaf / moss  
4. **Alerts** → cherry  
5. **Charts** → roast, moss, honey, bean, cherry (in that order)  
6. Avoid purple / neon; keep coffee + leaf identity

Legacy `--frappe-*` variables alias to these tokens so existing desk components pick up the theme without a mass rename.

**Atmosphere classes:** `.csolve-desk-bg`, `.csolve-login-bg`, `.csolve-sidebar`  
**Components:** `components/brand/csolve-mark.tsx`  
**Product name:** Csolve · tagline “Coffee stock · AI”
