import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity()
export class FileRecord {
    @PrimaryColumn()
    path: string;

    @Column()
    filteredPath: string;

    @Column()
    createdAt: Date;

    @Column()
    modifiedAt: Date;

    @Column()
    size: number;
}
