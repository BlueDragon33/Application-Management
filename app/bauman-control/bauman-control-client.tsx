"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- each Bauman Web App is an independently deployed Site. */

import { BAUMAN_HUB_URL, BAUMAN_SUBJECTS } from "../bauman-registry";

export default function BaumanControlClient({ user }: { user: { displayName: string; email: string } }) {
  return (
    <main className="bauman-control-shell">
      <header className="bauman-control-topbar">
        <a href="/" className="bauman-control-brand"><span>QT</span><div><small>QUẢN TRỊ ỨNG DỤNG</small><strong>Bauman</strong></div></a>
        <div className="bauman-control-user"><span>{user.displayName}</span><small>{user.email}</small><a href="/logout?return_to=/">Đăng xuất</a></div>
      </header>

      <section className="bauman-control-hero">
        <div><span className="bauman-eyebrow">BAUMAN CONTROL PLANE</span><h1>Quản trị Bauman,<br /><em>không phải Web App học tập.</em></h1><p>Điều phối Hub, kiểm tra liên kết và chuyển đúng quyền quản lý về từng Site môn học. Trang này không thay thế Bauman Hub và không gom dữ liệu học tập về Trung tâm.</p></div>
        <aside><span>Định danh quản trị</span><strong>{user.email}</strong><p>Tài khoản ChatGPT đang dùng; Gmail liên kết được dùng làm định danh nếu có.</p><i>Đã xác thực</i></aside>
      </section>

      <section className="bauman-control-actions" aria-label="Liên kết quản trị Bauman">
        <article><span>01 · HUB ĐIỀU PHỐI</span><h2>Bauman Master Hub</h2><p>Quản lý lộ trình, lịch học, học liệu và lối vào 8 Web App môn học.</p><div><a className="bauman-button primary" href={`${BAUMAN_HUB_URL}/?page=admin`} target="_blank" rel="noopener noreferrer">Quản trị Hub ↗</a><a className="bauman-button" href={BAUMAN_HUB_URL} target="_blank" rel="noopener noreferrer">Mở Web App Hub ↗</a></div></article>
        <article><span>02 · NỘI DUNG TỪNG MÔN</span><h2>8 Site độc lập</h2><p>Nội dung bài học được quản lý tại Site môn tương ứng; quyền và dữ liệu không dùng chung với Hub.</p><div><a className="bauman-button primary" href="#subjects">Chọn Site môn ↓</a></div></article>
        <article><span>03 · QUYỀN DÙNG CHUNG</span><h2>Hệ thống Trung tâm</h2><p>Tài khoản ChatGPT, thiết bị quản trị, vai trò và nhật ký dùng chung nằm ở khu Hệ thống.</p><div><a className="bauman-button primary" href="/system-control">Quản trị Hệ thống →</a></div></article>
      </section>

      <section id="subjects" className="bauman-subject-admin" aria-labelledby="bauman-subjects-title">
        <header><div><span className="bauman-eyebrow">SUBJECT ADMINISTRATION</span><h2 id="bauman-subjects-title">Quản lý từng Site môn học</h2><p>Chọn một môn để mở đúng Site nội dung. Bauman Hub chỉ điều phối; thay đổi bài học phải thực hiện tại Site môn.</p></div><span className="bauman-count">{BAUMAN_SUBJECTS.length} môn</span></header>
        <div className="bauman-subject-grid">{BAUMAN_SUBJECTS.map((subject, index) => <article key={subject.id}><span className="subject-number">{String(index + 1).padStart(2, "0")}</span><div><strong>{subject.title}</strong><p>{subject.detail}</p></div><a href={subject.href} target="_blank" rel="noopener noreferrer">Mở Site môn ↗</a></article>)}</div>
      </section>

      <section className="bauman-boundary"><span className="bauman-eyebrow">RANH GIỚI VẬN HÀNH</span><div><article><strong>Quản trị ở đây</strong><p>Liên kết Hub, trạng thái Site, lộ trình điều phối và đường vào quản trị từng mảng.</p></article><article><strong>Quản trị ở Site môn</strong><p>Bài học, bài tập, câu hỏi, bản nháp và phát hành nội dung của từng môn.</p></article><article><strong>Không làm ở đây</strong><p>Không chia sẻ runtime, API, database hoặc thống kê học tập giữa các Site.</p></article></div></section>

      <footer><a href="/">← Về Quản trị ứng dụng</a><span>Bauman · Hub điều phối · 8 Site nội dung độc lập</span></footer>
    </main>
  );
}
