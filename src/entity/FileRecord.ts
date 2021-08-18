import { Entity, PrimaryColumn, Column, Index } from "typeorm";

@Entity()
@Index("path_lower_trgm_gin_index", { synchronize: false })
@Index("path_filtered_trgm_gin_index", { synchronize: false })
export class FileRecord {
    @PrimaryColumn()
    path: string;

    @Column()
    pathLower: string;

    @Column()
    filteredPath: string;

    @Column()
    createdAt: Date;

    @Column()
    modifiedAt: Date;

    @Column()
    size: number;
}
