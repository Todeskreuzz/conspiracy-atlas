export declare const BACKUP_TABLES: readonly string[];
export declare function toCsv(rows: Array<Record<string, unknown>>): string;
export declare function sqlLiteral(value: unknown): string;
export declare function validateBackup(data: unknown): { format: string; version: number; tables: Record<string, Array<Record<string, unknown>>> };
export declare function backupToSql(data: unknown): string;
