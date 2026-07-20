import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_SETTINGS, type Settings, type SkillField } from "@flr/shared";
import { createGroupRef } from "../lib/group-url";
import {
  chromeLocalStorage,
  readSettings,
  writeSettings,
} from "../lib/storage";
import { createUlid } from "../lib/ulid";
import "../ui/styles.css";

const SKILLS: readonly { value: SkillField; label: string }[] = [
  { value: "graphic_design", label: "Thiết kế đồ họa" },
  { value: "video_editing", label: "Video / dựng phim" },
  { value: "web_dev", label: "Web / lập trình" },
  { value: "architecture", label: "Kiến trúc" },
];

const Options = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [groupName, setGroupName] = useState("");
  const [groupUrl, setGroupUrl] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberContact, setMemberContact] = useState("");
  const [memberSkill, setMemberSkill] = useState<SkillField>("graphic_design");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void readSettings(chromeLocalStorage).then(setSettings);
  }, []);

  const addGroup = (event: FormEvent) => {
    event.preventDefault();
    try {
      const group = createGroupRef(groupName, groupUrl);
      if (settings.allowlist.some((item) => item.groupId === group.groupId)) {
        throw new Error("Nhóm này đã có trong allowlist");
      }
      setSettings({ ...settings, allowlist: [...settings.allowlist, group] });
      setGroupName("");
      setGroupUrl("");
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "URL nhóm không hợp lệ",
      );
    }
  };

  const addMember = (event: FormEvent) => {
    event.preventDefault();
    if (memberName.trim().length === 0) {
      setError("Tên thành viên không được để trống");
      return;
    }
    setSettings({
      ...settings,
      members: [
        ...settings.members,
        {
          id: createUlid(),
          name: memberName.trim(),
          skills: [memberSkill],
          contact: memberContact.trim() || undefined,
          active: true,
        },
      ],
    });
    setMemberName("");
    setMemberContact("");
    setError("");
  };

  const toggleTeamSkill = (skill: SkillField) => {
    const exists = settings.teamSkills.includes(skill);
    const next = exists
      ? settings.teamSkills.filter((item) => item !== skill)
      : [...settings.teamSkills, skill];
    if (next.length === 0) {
      setError("Team phải có ít nhất một kỹ năng");
      return;
    }
    setSettings({ ...settings, teamSkills: next });
    setError("");
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await writeSettings(chromeLocalStorage, settings);
      setSettings(saved);
      setError("");
      setNotice("Đã lưu cài đặt trên máy này.");
    } catch (reason) {
      setNotice("");
      setError(
        reason instanceof Error ? reason.message : "Cài đặt không hợp lệ",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="app app--wide">
      <header className="brand">
        <span className="brand__mark">FL</span>
        <div>
          <h1>Cài đặt Freelance Lead Radar</h1>
          <p className="muted">P6 — pipeline chỉ đọc, cấu hình local</p>
        </div>
      </header>

      {error ? (
        <div aria-live="assertive" className="notice notice--danger toast">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div aria-live="polite" className="notice toast">
          {notice}
        </div>
      ) : null}

      <section className="card">
        <h2>Nhóm Facebook allowlist</h2>
        <p className="muted">
          Extension chỉ thức dậy trên đúng những nhóm đang bật trong danh sách
          này.
        </p>
        <form className="grid" onSubmit={addGroup}>
          <label>
            Tên gợi nhớ
            <input
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Ví dụ: Freelancer Việt Nam"
              value={groupName}
            />
          </label>
          <label>
            URL nhóm
            <input
              onChange={(event) => setGroupUrl(event.target.value)}
              placeholder="https://www.facebook.com/groups/..."
              value={groupUrl}
            />
          </label>
          <button className="button" type="submit">
            Thêm nhóm
          </button>
        </form>
        <ul className="list">
          {settings.allowlist.map((group) => (
            <li className="list__item" key={group.groupId}>
              <div>
                <strong>{group.name}</strong>
                <p className="muted">
                  {group.groupId} · {group.active ? "Đang bật" : "Đang tắt"}
                </p>
              </div>
              <div className="actions">
                <button
                  className="button button--secondary button--small"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      allowlist: settings.allowlist.map((item) =>
                        item.groupId === group.groupId
                          ? { ...item, active: !item.active }
                          : item,
                      ),
                    })
                  }
                  type="button"
                >
                  {group.active ? "Tắt" : "Bật"}
                </button>
                <button
                  className="button button--secondary button--small"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      allowlist: settings.allowlist.filter(
                        (item) => item.groupId !== group.groupId,
                      ),
                    })
                  }
                  type="button"
                >
                  Xóa
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Năng lực team</h2>
        <div className="checks">
          {SKILLS.map((skill) => (
            <label key={skill.value}>
              <input
                checked={settings.teamSkills.includes(skill.value)}
                onChange={() => toggleTeamSkill(skill.value)}
                type="checkbox"
              />
              {skill.label}
            </label>
          ))}
        </div>
        <label>
          Hồ sơ năng lực ngắn
          <textarea
            maxLength={1000}
            onChange={(event) =>
              setSettings({ ...settings, teamProfile: event.target.value })
            }
            placeholder="Nêu đúng năng lực thật để AI không bịa."
            value={settings.teamProfile}
          />
        </label>
      </section>

      <section className="card">
        <h2>Thành viên</h2>
        <form className="grid" onSubmit={addMember}>
          <label>
            Tên
            <input
              onChange={(event) => setMemberName(event.target.value)}
              value={memberName}
            />
          </label>
          <label>
            Liên hệ
            <input
              onChange={(event) => setMemberContact(event.target.value)}
              value={memberContact}
            />
          </label>
          <label>
            Kỹ năng chính
            <select
              onChange={(event) =>
                setMemberSkill(event.target.value as SkillField)
              }
              value={memberSkill}
            >
              {SKILLS.map((skill) => (
                <option key={skill.value} value={skill.value}>
                  {skill.label}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            Thêm thành viên
          </button>
        </form>
        <ul className="list">
          {settings.members.map((member) => (
            <li className="list__item" key={member.id}>
              <div>
                <strong>{member.name}</strong>
                <p className="muted">{member.skills.join(", ")}</p>
              </div>
              <button
                className="button button--secondary button--small"
                onClick={() =>
                  setSettings({
                    ...settings,
                    members: settings.members.filter(
                      (item) => item.id !== member.id,
                    ),
                  })
                }
                type="button"
              >
                Xóa
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>API và giới hạn an toàn</h2>
        <div className="grid">
          <label>
            API Base URL
            <input
              onChange={(event) =>
                setSettings({ ...settings, apiBaseUrl: event.target.value })
              }
              placeholder="https://...workers.dev"
              value={settings.apiBaseUrl}
            />
          </label>
          <label>
            TEAM_TOKEN
            <input
              autoComplete="off"
              onChange={(event) =>
                setSettings({ ...settings, teamToken: event.target.value })
              }
              placeholder="Để trống trong P5"
              type="password"
              value={settings.teamToken}
            />
          </label>
          <label>
            Bình luận tối đa/ngày
            <input
              max={100}
              min={1}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  limits: {
                    ...settings.limits,
                    maxCommentsPerDay: Number(event.target.value),
                  },
                })
              }
              type="number"
              value={settings.limits.maxCommentsPerDay}
            />
          </label>
          <label>
            Khoảng cách tối thiểu (phút)
            <input
              max={1440}
              min={1}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  limits: {
                    ...settings.limits,
                    minCommentIntervalMin: Number(event.target.value),
                  },
                })
              }
              type="number"
              value={settings.limits.minCommentIntervalMin}
            />
          </label>
          <label>
            AI calls tối đa/ngày
            <input
              max={10000}
              min={1}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  limits: {
                    ...settings.limits,
                    maxAiCallsPerDay: Number(event.target.value),
                  },
                })
              }
              type="number"
              value={settings.limits.maxAiCallsPerDay}
            />
          </label>
          <label>
            Lưu lead (ngày)
            <input
              max={365}
              min={1}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  retentionDays: Number(event.target.value),
                })
              }
              type="number"
              value={settings.retentionDays}
            />
          </label>
        </div>
        <p className="muted">
          Auto Reply không có nút bật trong MVP. Mọi bình luận vẫn phải do con
          người duyệt và tự bấm Đăng.
        </p>
      </section>

      <button
        className="button"
        disabled={saving}
        onClick={() => void save()}
        type="button"
      >
        {saving ? "Đang lưu..." : "Lưu toàn bộ cài đặt"}
      </button>
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
