import { type JSX } from 'solid-js';
export type UserRow = {
    id: string;
    name: string;
    email: string;
    role: string;
    banned: boolean;
    banReason?: string | null;
    createdAt: string;
    /** владелец системы: любые действия над ним запрещены сервером */
    isOwner?: boolean;
    /** число активных сессий; undefined — не считаем */
    sessions?: number;
};
export type RoleOption = {
    value: string;
    label: string;
    /** одной строкой: что роль позволяет; собирается в подсказку под формой */
    hint?: string;
};
/** Все тексты — снаружи. Дефолты русские, как и везде в ките. */
export type UserManagerLabels = {
    title?: string;
    createTitle?: string;
    name?: string;
    email?: string;
    password?: string;
    /** подсказка у поля пароля: что будет, если оставить пустым */
    passwordEmpty?: string;
    submit?: string;
    colUser?: string;
    colRole?: string;
    colAccess?: string;
    colCreated?: string;
    colActions?: string;
    you?: string;
    owner?: string;
    ownerHint?: string;
    active?: string;
    sessions?: string;
    banned?: string;
    setPassword?: string;
    setPasswordHint?: string;
    ownerPasswordHint?: string;
    apply?: string;
    cancel?: string;
    ban?: string;
    banHint?: string;
    banSelfHint?: string;
    banOwnerHint?: string;
    unban?: string;
    revoke?: string;
    revokeHint?: string;
    remove?: string;
    removeHint?: string;
    removeSelfHint?: string;
    removeOwnerHint?: string;
    removeConfirm?: string;
    /** сорвалось, а сервер не сказал почему */
    failed?: string;
    bannedOk?: string;
    unbannedOk?: string;
    revokedOk?: string;
    removedOk?: string;
    /** пароль нового сотрудника: показывается ровно один раз */
    createdOk?: (password: string) => string;
    passwordSetOk?: (user: UserRow, password: string) => string;
};
export type DumbUserManagerProps = {
    users: Array<UserRow>;
    /** словарь ролей; пусто — роль показывается текстом, без выбора */
    roles?: Array<RoleOption>;
    /** id текущего пользователя: себе нельзя блокировку и удаление */
    currentUserId?: string;
    /** значение роли по умолчанию в форме создания */
    defaultRole?: string;
    /** не задан — формы «выдать доступ» нет */
    onCreate?: (input: {
        name: string;
        email: string;
        password: string;
        role: string;
    }) => Promise<void>;
    /** не задан — роль показывается текстом */
    onSetRole?: (userId: string, role: string) => Promise<void>;
    onSetPassword?: (userId: string, password: string) => Promise<void>;
    onBan?: (userId: string, reason: string) => Promise<void>;
    onUnban?: (userId: string) => Promise<void>;
    onRevokeSessions?: (userId: string) => Promise<void>;
    onRemove?: (userId: string) => Promise<void>;
    /** форматирование даты создания; по умолчанию — как пришло */
    formatDate?: (iso: string) => string;
    /** заголовок; пустая строка — без заголовка */
    title?: string;
    labels?: UserManagerLabels;
    /** дополнительные классы на корень: отступы и ширину задаёт потребитель */
    class?: string;
};
export declare function DumbUserManager(props: DumbUserManagerProps): JSX.Element;
