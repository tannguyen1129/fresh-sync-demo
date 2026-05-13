# FreshSync Demo Data

## Demo Accounts

Password for all demo users: `123456`

| Role | Email | Main screen |
| --- | --- | --- |
| Operator | `ops@port.com` | `/operator/dashboard` |
| Business | `biz@logistics.com` | `/business/dashboard` |
| Driver | `driver@fleet.com` | `/driver/dashboard` |
| Authority | `admin@authority.gov` | `/authority/dashboard` |
| Shipping Line System | `system@one-line.com` | API only |
| TOS System | `tos@terminal.local` | API only |

## Core Containers

| Container | Scenario | Expected result |
| --- | --- | --- |
| `CONT-001` | Green path | Recommendation returns green slot, confirm creates assignment, full driver flow works |
| `CONT-013` | Commercial hold | Business request is blocked with `COMMERCIAL_HOLD` |
| `CONT-014` | Container not ready | Business request is blocked with `CONTAINER_NOT_READY` |
| `CONT-003` | ZONE_B disruption demo | Operator block on `ZONE_B` re-optimizes this booking to `RESCHEDULED` |
| `CONT-002`, `CONT-004` | ROI/ESG seed history | Business ROI and Authority ESG show non-empty historical metrics |

## Driver / Fleet

Primary demo driver:

- `Nguyen Van A`
- Plate: `51C-123.45`
- Login: `driver@fleet.com`

Additional historical ROI drivers:

- `Tran Van B`
- `Vu Van F`

## Depots

| Depot | Use in demo | Notes |
| --- | --- | --- |
| `Depot A (Tan Thuan)` | Smart empty return green choice | Open, healthy utilization |
| `Depot B (Cat Lai)` | Alternate choice | Higher load and higher traffic |
| `Depot D (ICD Thu Duc)` | Excluded in return optimization | `FULL`, should not be selected |

## Key Operator Targets

| Target | Use |
| --- | --- |
| `ZONE_B` | Main disruption / re-optimization scenario |
| `GATE_1` | Gate congestion scenario |
| `CONT-001` | Manual commercial block scenario |

## ESG / ROI Assumptions

Seeded in `SystemSetting` key `ESG_ASSUMPTIONS`:

- Diesel burn rate: `2.5 L/hour`
- Fuel price: `$1.2 / liter`
- CO2 factor: `2.68 kg / liter`
- Idle time saved per peak avoided: `45 minutes`
- Early-arrival prevention saving: `20 minutes`
- Baseline fleet utilization: `4.5 trips / truck / week`
