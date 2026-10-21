import pg from 'pg';

/**
 * Verifica la migración inicial contra el Postgres de Docker (o el servicio de la CI).
 * Cada caso corre dentro de una transacción que se revierte, así que no deja datos.
 */
describe('Esquema de base de datos (migración inicial)', () => {
  let cliente: pg.Client;

  beforeAll(async () => {
    cliente = new pg.Client({ connectionString: process.env.DIRECT_URL });
    await cliente.connect();
  });

  afterAll(async () => {
    await cliente.end();
  });

  beforeEach(async () => {
    await cliente.query('BEGIN');
  });

  afterEach(async () => {
    await cliente.query('ROLLBACK');
  });

  const tablas = async (): Promise<string[]> => {
    const { rows } = await cliente.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    return rows.map((fila) => fila.table_name);
  };

  const crearUsuario = async (correo: string): Promise<string> => {
    const { rows } = await cliente.query<{ id: string }>(
      `INSERT INTO usuarios (id, correo, hash_contrasena) VALUES (gen_random_uuid(), $1, 'x') RETURNING id`,
      [correo],
    );
    return rows[0].id;
  };

  it('crea todas las tablas del modelo de datos', async () => {
    expect(await tablas()).toEqual(
      expect.arrayContaining([
        'usuarios',
        'sesiones',
        'categorias',
        'productos',
        'stock',
        'reglas_compatibilidad',
        'configuraciones',
        'configuracion_items',
        'carritos',
        'carrito_items',
        'reservas',
        'reserva_items',
        'ordenes',
        'orden_items',
        'comprobantes',
        'notificaciones',
        'uso_asistente',
      ]),
    );
  });

  it('no crea tokens_recuperacion (HU-03 diferida)', async () => {
    expect(await tablas()).not.toContain('tokens_recuperacion');
  });

  it('guarda los atributos técnicos en JSONB y la versión del stock', async () => {
    const { rows } = await cliente.query<{
      table_name: string;
      column_name: string;
      data_type: string;
    }>(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE (table_name, column_name) IN (('productos', 'atributos_tecnicos'), ('stock', 'version'))`,
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          table_name: 'productos',
          column_name: 'atributos_tecnicos',
          data_type: 'jsonb',
        },
        { table_name: 'stock', column_name: 'version', data_type: 'integer' },
      ]),
    );
  });

  it('rechaza un correo duplicado', async () => {
    await crearUsuario('duplicado@prueba.pe');
    await expect(crearUsuario('duplicado@prueba.pe')).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('rechaza una clave de idempotencia duplicada', async () => {
    const usuarioId = await crearUsuario('orden@prueba.pe');
    const insertarOrden = () =>
      cliente.query(
        `INSERT INTO ordenes (id, usuario_id, clave_idempotencia, total)
         VALUES (gen_random_uuid(), $1, 'clave-1', 100.00)`,
        [usuarioId],
      );
    await insertarOrden();
    await expect(insertarOrden()).rejects.toMatchObject({ code: '23505' });
  });

  it('rechaza un ítem de carrito sin producto ni configuración', async () => {
    const usuarioId = await crearUsuario('carrito@prueba.pe');
    const { rows } = await cliente.query<{ id: string }>(
      `INSERT INTO carritos (id, usuario_id, actualizado_en) VALUES (gen_random_uuid(), $1, now()) RETURNING id`,
      [usuarioId],
    );
    await expect(
      cliente.query(
        `INSERT INTO carrito_items (id, carrito_id, cantidad) VALUES (gen_random_uuid(), $1, 1)`,
        [rows[0].id],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'carrito_items_producto_o_configuracion',
    });
  });
});
