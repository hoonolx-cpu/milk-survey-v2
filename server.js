import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite
const dbPath = path.join(__dirname, 'data.sqlite');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS milk_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_no INTEGER,
    student_name TEXT NOT NULL,
    date TEXT NOT NULL,
    amount TEXT,
    note TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_milk_records_student_no ON milk_records(student_no);


  CREATE INDEX IF NOT EXISTS idx_milk_records_date ON milk_records(date);
`);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Serve static (if you later add CSS/images)
app.use('/static', express.static(path.join(__dirname, 'static')));

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#39;');
}

function formatDateISO(d) {
  // d: Date
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

app.get('/', (req, res) => {
  res.redirect('/student');
});

app.get('/student', (req, res) => {
  const today = formatDateISO(new Date());
  res.type('html').send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>생활 기록부 - 우유 마심 기록(학생)</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; }
    .card { max-width: 720px; padding: 18px; border: 1px solid #ddd; border-radius: 12px; }
    input, textarea { width: 100%; padding: 10px; margin: 6px 0 14px; border: 1px solid #ccc; border-radius: 10px; }
    label { font-weight: 600; }
    button { padding: 10px 14px; border: 0; border-radius: 10px; background: #2563eb; color: #fff; cursor: pointer; }
    a { color: #2563eb; text-decoration: none; }
    small { color: #666; }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin-top:0;">우유 마심 기록(학생 입력)</h2>
    <p><small>선생님은 로그인 없이 <a href="/teacher">/teacher</a>에서 기록을 확인할 수 있어요.</small></p>

    <form method="POST" action="/student/add">
      <label>이름</label>
      <input name="student_name" placeholder="예: 홍길동" required />

      <label>번호(1번, 2번... 선택)</label>
      <input name="student_no" inputmode="numeric" placeholder="예: 21" />

      <label>날짜</label>
      <input type="date" name="date" value="${today}" required />


      <label>양(선택)</label>
      <input name="amount" placeholder="예: 1팩, 반팩, 한 컵" />

      <label>메모(선택)</label>
      <textarea name="note" placeholder="예: 점심 후 마심"></textarea>

      <button type="submit">기록 추가</button>
    </form>

    <hr style="margin: 18px 0;" />
    <p>추가된 기록은 자동으로 선생님 열람 페이지에 반영됩니다.</p>
  </div>
</body>
</html>`);
});

app.post('/student/add', (req, res) => {
  const { student_name, student_no, date, amount, note } = req.body;

  if (!student_name || !date) {
    return res.status(400).send('student_name and date are required');
  }

  const studentNoNum = student_no ? Number(student_no) : null;
  // 서버 시간 기준으로 created_at 저장(친구가 입력 시간을 조작할 수 없게)
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO milk_records (student_no, student_name, date, amount, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);


  stmt.run(
    Number.isFinite(studentNoNum) ? studentNoNum : null,
    student_name.trim(),
    date,
    amount?.trim() ?? null,
    note?.trim() ?? null,
    now
  );


  res.redirect('/student');
});

app.get('/teacher', (req, res) => {
  // 날짜별 그룹(섹션) + 섹션 내부는 created_at 내림차순
  const rows = db
    .prepare(`
      SELECT id, student_no, student_name, date, amount, note, created_at
      FROM milk_records
      ORDER BY date DESC,
               created_at DESC,
               COALESCE(student_no, 999999) ASC,
               id DESC
      LIMIT 200
    `)
    .all();

  const grouped = new Map();
  for (const r of rows) {
    const d = r.date;
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d).push(r);
  }

  const sections = Array.from(grouped.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => {
      const items = list
        .map((r) => {
          const note = r.note ? escapeHtml(r.note) : '';
          const amount = r.amount ? escapeHtml(r.amount) : '';
      // created_at은 ISO 문자열(UTC 기반)로 저장되지만, 화면에서는 한국 시간(KST)로 표시
      const createdKST = new Date(r.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

      const studentNo = r.student_no ?? '';
      return `
            <tr>
              <td style="width:70px;">${studentNo}</td>
              <td style="width:180px;">${escapeHtml(r.student_name)}</td>
              <td style="width:200px;">${amount}</td>
              <td>${note}</td>
              <td style="width:220px;">
                <div>${createdKST}</div>
                <div style="font-size:12px;color:#999;">UTC: ${createdUTC}</div>
              </td>


            </tr>
          `;
        })
        .join('');

      return `
        <section style="border:1px solid #eee; border-radius:12px; padding:14px; margin:14px 0;">
          <div style="display:flex; align-items:baseline; justify-content:space-between; gap:12px;">
            <h3 style="margin:0; font-size:18px;">${escapeHtml(date)}</h3>
            <div class="meta">총 ${list.length}건</div>
          </div>
          <table style="width:100%; border-collapse:collapse; margin-top:10px;">
            <thead>
              <tr>
                <th style="background:#f7f7f7; border:1px solid #ddd; padding:10px; text-align:left; width:70px;">-</th>
                <th style="background:#f7f7f7; border:1px solid #ddd; padding:10px; text-align:left; width:180px;">이름</th>
                <th style="background:#f7f7f7; border:1px solid #ddd; padding:10px; text-align:left; width:200px;">양</th>
                <th style="background:#f7f7f7; border:1px solid #ddd; padding:10px; text-align:left;">메모</th>
                <th style="background:#f7f7f7; border:1px solid #ddd; padding:10px; text-align:left; width:220px;">입력 시간</th>
              </tr>
            </thead>
            <tbody>
              ${items || '<tr><td colspan="5" style="padding:10px;">등록된 기록이 없습니다.</td></tr>'}
            </tbody>
          </table>
        </section>
      `;
    });

  res.type('html').send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>생활 기록부 - 우유 마심 기록(선생님)</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; }
    .wrap { max-width: 1100px; }
    h2 { margin-top: 0; }
    .meta { color: #666; font-size: 14px; }
    a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <h2>우유 마심 기록(선생님 확인)</h2>
    <p class="meta">로그인 없이 조회됩니다. (기록은 학생 입력 페이지에서 추가됩니다.)</p>
    <p><a href="/student">학생 입력 페이지로 이동</a></p>

    <div style="margin:14px 0; padding:12px; background:#f9fafb; border:1px solid #eee; border-radius:12px;">
      <div style="font-weight:700; margin-bottom:6px;">정렬 기준 안내</div>
      <div class="meta">
        - 날짜는 최근순 / 각 날짜 내 목록은 <b>입력 시간(created_at) 내림차순</b>으로 표시됩니다.
        <br/>
        - 학생이 “1번, 2번, 7번…”처럼 <b>번호 고정 순서</b>로 보이게 하려면, 입력 폼에 학생 번호를 추가로 저장해야 합니다.
      </div>
    </div>

    ${sections.length ? sections.join('') : '<div class="meta">등록된 기록이 없습니다.</div>'}
  </div>
</body>
</html>`);
});

app.listen(PORT, () => {
  const hostname = globalThis.require?.('os')?.hostname?.() ?? 'localhost';
  console.log(`Milk records server running: http://localhost:${PORT}`);
  console.log(`Student: http://localhost:${PORT}/student`);
  console.log(`Teacher: http://localhost:${PORT}/teacher`);
  console.log(`Teacher (LAN): http://${hostname}:${PORT}/teacher`);
});

