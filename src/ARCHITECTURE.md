# Arquitetura — FrotaLog

Estrutura em camadas (Clean Architecture + POO) dentro de `src/`.

```
src/
├── domain/                    # Regras de negócio puras (sem Supabase/React)
│   ├── entities/              # Veiculo, Manutencao, Empresa, usuario/*
│   ├── value-objects/         # Money, Quilometragem, PeriodoFinanceiro
│   ├── repositories/          # Interfaces (IVeiculoRepository, ...)
│   ├── services/              # FinancialReportService, MaintenanceUrgencyService, ...
│   └── types/                 # Enums de domínio
│
├── application/               # Orquestração de casos de uso
│   ├── use-cases/             # GetFinancialReportUseCase, ListVeiculosUseCase, ...
│   └── services/              # PermissionService (adaptador UI ↔ domínio)
│
├── infrastructure/            # Detalhes externos (Supabase)
│   ├── mappers/               # Row/DTO ↔ Entidade
│   ├── repositories/          # SupabaseVeiculoRepository, ...
│   └── di/                    # container.ts (Composition Root)
│
├── services/                  # Facades — compatibilidade com páginas existentes
├── components/                # Apresentação (React)
├── pages/                     # Apresentação (React)
├── hooks/                     # usePermissions → PermissionService
├── contexts/                  # Auth, Tenant
├── lib/                       # Utilitários legados (facades para domain)
└── types/                     # DTOs compartilhados com UI (database.ts)
```

## Fluxo de dados

```
Page/Component → services/*.ts (facade) → application/use-cases → domain/services
                                                      ↓
                                         infrastructure/repositories → Supabase
```

## Hierarquia de usuários

| Classe       | Métodos principais |
|-------------|-------------------|
| `SuperAdmin` | `podeVisualizarEmpresa()` → todas |
| `Gestor`     | CRUD veículos/manutenções na própria empresa |
| `Mecanico`   | `podeRegistrarManutencao()`, `podeAtualizarKm()` |
| `Motorista`  | `isSomenteLeitura()` → true |

Instanciação: `UsuarioFactory.fromProfile(profile)`.

## Permissões na UI

```typescript
const { canManageVehicles } = usePermissions()
// Internamente: PermissionService → usuario.podeGerenciarVeiculos()
```

Não use `if (perfil === 'gestor')` nas páginas — use os métodos expostos pelo hook.
