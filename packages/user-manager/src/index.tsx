export {
  DumbUserManager,
  type DumbUserManagerProps,
  type RoleOption,
  type UserManagerLabels,
  type UserRow,
} from './DumbUserManager'

/**
 * Читаемый пароль без Solid: пригодится и вне компонента — в форме регистрации,
 * в скрипте наполнения базы, в тесте.
 */
export { suggestPassword } from './password'
