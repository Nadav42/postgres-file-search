import { Entity, PrimaryColumn, Column, Index } from "typeorm";

// full path: c:/program files/google/chrome/chrome-87/setup.exe
// preFilteredPath: c:/program files/google/chrome
// filteredPath: chrome-87/setup.exe
// preFilteredPath + filteredPath = full path

@Entity()
@Index("path_pre_filtered_trgm_gin_index", { synchronize: false })
@Index("path_filtered_trgm_gin_index", { synchronize: false })
export class FileRecord {
    @PrimaryColumn()
    path: string;

    @Column()
    pathLower: string;

    @Column()
    preFilteredPath: string;

    @Column()
    filteredPath: string;

    @Column()
    createdAt: Date;

    @Column()
    modifiedAt: Date;

    @Column({ type: 'bigint' })
    size: number;
}
