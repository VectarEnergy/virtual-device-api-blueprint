import { DataTypes, type QueryInterface } from 'sequelize';

async function tableExists(qi: QueryInterface, name: string): Promise<boolean> {
  const tables = await qi.showAllTables();
  return tables.some((t) => String(t).toLowerCase() === name.toLowerCase());
}

/** Idempotent for DBs created with legacy `sequelize.sync()`. */
export async function up({
  context: queryInterface,
}: {
  context: QueryInterface;
}): Promise<void> {
  if (await tableExists(queryInterface, 'sites')) {
    return;
  }
  await queryInterface.createTable('sites', {
    siteId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    cumulative: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    lastHour: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    history: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  });
}

export async function down({
  context: queryInterface,
}: {
  context: QueryInterface;
}): Promise<void> {
  await queryInterface.dropTable('sites');
}
