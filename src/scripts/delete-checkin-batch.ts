import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const LEGACY_GRADUATION_BATCH = 'TN2026';

type Options = {
  batch?: string;
  confirmation?: string;
  execute: boolean;
  deleteStudents: boolean;
  help: boolean;
};

type BatchSummary = {
  checkins: number;
  students: number;
  checkinsOutsideBatchForStudents: number;
};

const checkinMatchesBatch = `
  COALESCE(
    c.dot_tot_nghiep = $1
    OR (
      $1 = '${LEGACY_GRADUATION_BATCH}'
      AND c.dot_tot_nghiep IS NULL
      AND (s.phone = $1 OR s.class_name = $1)
    ),
    FALSE
  )
`;

const studentMatchesBatch = `
  COALESCE(
    s.dot_tot_nghiep = $1
    OR (
      $1 = '${LEGACY_GRADUATION_BATCH}'
      AND s.dot_tot_nghiep IS NULL
      AND (s.phone = $1 OR s.class_name = $1)
    ),
    FALSE
  )
`;

function printUsage() {
  console.log(`
Xóa dữ liệu check-in của một đợt tốt nghiệp.

Cú pháp:
  npm run delete:checkin-batch -- --batch=TN2026_dot_2
  npm run delete:checkin-batch -- --batch=TN2026_dot_2 --execute --confirm=TN2026_dot_2

Tùy chọn:
  --batch=<mã> | --dot-tot-nghiep=<mã>  Mã đợt cần xử lý (bắt buộc).
  --execute                               Thực hiện xóa. Bỏ qua cờ này chỉ xem trước.
  --confirm=<mã>                          Phải trùng chính xác với --batch khi dùng --execute.
  --delete-students                       Xóa cả sinh viên thuộc đợt sau khi xóa check-in.
                                            Bị chặn nếu các sinh viên này có check-in ở đợt khác.
  --help                                  Hiển thị hướng dẫn này.

Mặc định chỉ xóa bản ghi trong bảng checkins. Không dùng npm run seed cho tác vụ này,
vì seed xóa dữ liệu của tất cả các đợt.
`);
}

function readOptionValue(args: string[], index: number, optionName: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} cần có giá trị.`);
  }
  return value;
}

function setBatch(options: Options, value: string) {
  const batch = value.trim();
  if (!batch) {
    throw new Error('Mã đợt không được để trống.');
  }
  if (options.batch && options.batch !== batch) {
    throw new Error('Chỉ được chỉ định một mã đợt.');
  }
  options.batch = batch;
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    execute: false,
    deleteStudents: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--delete-students') {
      options.deleteStudents = true;
    } else if (arg === '--batch' || arg === '--dot-tot-nghiep') {
      setBatch(options, readOptionValue(args, index, arg));
      index += 1;
    } else if (arg.startsWith('--batch=')) {
      setBatch(options, arg.slice('--batch='.length));
    } else if (arg.startsWith('--dot-tot-nghiep=')) {
      setBatch(options, arg.slice('--dot-tot-nghiep='.length));
    } else if (arg === '--confirm') {
      options.confirmation = readOptionValue(args, index, arg).trim();
      index += 1;
    } else if (arg.startsWith('--confirm=')) {
      options.confirmation = arg.slice('--confirm='.length).trim();
    } else {
      throw new Error(`Không nhận diện được tùy chọn: ${arg}`);
    }
  }

  if (options.batch && options.batch.length > 100) {
    throw new Error('Mã đợt không được dài quá 100 ký tự.');
  }

  return options;
}

function countFromRow(row?: { count: string }) {
  return Number(row?.count ?? 0);
}

async function getSummary(
  client: Client,
  batch: string,
): Promise<BatchSummary> {
  const checkinsResult = await client.query<{ count: string }>(
    `
        SELECT COUNT(*)::text AS count
        FROM checkins c
        INNER JOIN students s ON s.id = c.student_id
        WHERE ${checkinMatchesBatch}
      `,
    [batch],
  );
  const studentsResult = await client.query<{ count: string }>(
    `
        SELECT COUNT(*)::text AS count
        FROM students s
        WHERE ${studentMatchesBatch}
      `,
    [batch],
  );
  const outsideBatchCheckinsResult = await client.query<{ count: string }>(
    `
        SELECT COUNT(*)::text AS count
        FROM checkins c
        INNER JOIN students s ON s.id = c.student_id
        WHERE ${studentMatchesBatch}
          AND NOT (${checkinMatchesBatch})
      `,
    [batch],
  );

  return {
    checkins: countFromRow(checkinsResult.rows[0]),
    students: countFromRow(studentsResult.rows[0]),
    checkinsOutsideBatchForStudents: countFromRow(
      outsideBatchCheckinsResult.rows[0],
    ),
  };
}

function printSummary(batch: string, summary: BatchSummary) {
  console.log(`\nĐợt: ${batch}`);
  console.log(`- Check-in sẽ bị xóa: ${summary.checkins}`);
  console.log(`- Sinh viên thuộc đợt: ${summary.students}`);
  console.log(
    `- Check-in ở đợt khác của các sinh viên trên: ${summary.checkinsOutsideBatchForStudents}`,
  );
}

async function deleteBatchData(
  client: Client,
  batch: string,
  deleteStudents: boolean,
) {
  const deletedCheckins = await client.query(
    `
      DELETE FROM checkins c
      USING students s
      WHERE c.student_id = s.id
        AND ${checkinMatchesBatch}
    `,
    [batch],
  );

  let deletedStudents = 0;
  if (deleteStudents) {
    const result = await client.query(
      `
        DELETE FROM students s
        WHERE ${studentMatchesBatch}
      `,
      [batch],
    );
    deletedStudents = result.rowCount ?? 0;
  }

  return {
    checkins: deletedCheckins.rowCount ?? 0,
    students: deletedStudents,
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (!options.batch) {
    printUsage();
    throw new Error('Thiếu --batch hoặc --dot-tot-nghiep.');
  }

  if (options.execute && options.confirmation !== options.batch) {
    throw new Error(
      'Khi dùng --execute, cần truyền --confirm với giá trị trùng chính xác --batch.',
    );
  }

  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'dut_job_fair',
    connectionTimeoutMillis: 3000,
  });

  try {
    await client.connect();
    await client.query('BEGIN');

    const summary = await getSummary(client, options.batch);
    printSummary(options.batch, summary);

    if (!options.execute) {
      await client.query('ROLLBACK');
      console.log(
        '\nChế độ xem trước: chưa có dữ liệu nào bị xóa. Thêm --execute và --confirm để thực hiện.',
      );
      return;
    }

    if (options.deleteStudents && summary.checkinsOutsideBatchForStudents > 0) {
      throw new Error(
        'Không thể xóa sinh viên: có check-in của các sinh viên này ở đợt khác. Chỉ xóa check-in, hoặc xử lý các check-in kia trước.',
      );
    }

    const deleted = await deleteBatchData(
      client,
      options.batch,
      options.deleteStudents,
    );
    await client.query('COMMIT');

    console.log('\nĐã xóa thành công.');
    console.log(`- Check-in đã xóa: ${deleted.checkins}`);
    if (options.deleteStudents) {
      console.log(`- Sinh viên đã xóa: ${deleted.students}`);
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nLỗi: ${message}`);
  process.exitCode = 1;
});
