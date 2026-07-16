"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { firebaseEnabled, loadScores, saveScore } from "@/lib/firebase";

const MODES = {
  easy: { label: "쉬움", range: "1,000–2,000", min: 1000, max: 2000 },
  normal: { label: "보통", range: "2,000–4,000", min: 2000, max: 4000 },
  hard: { label: "어려움", range: "4,000–8,000", min: 4000, max: 8000 }
};

const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const formatTime = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}.${String(Math.floor((seconds % 1) * 100)).padStart(2, "0")}`;

function RiceCanvas({ game, setGame }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const riceRef = useRef([]);

  useEffect(() => {
    if (!game) return;
    const seeded = Array.from({ length: game.answer }, (_, id) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * 0.82;
      return {
        id,
        bx: Math.cos(angle) * radius,
        by: Math.sin(angle) * radius,
        rotation: Math.random() * Math.PI,
        place: "bowl"
      };
    });
    riceRef.current = seeded;
  }, [game?.id]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !game) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const bowl = { x: game.bowl.x * w, y: game.bowl.y * h, rx: Math.min(w * 0.25, 210), ry: Math.min(h * 0.25, 145) };
    const glow = ctx.createRadialGradient(bowl.x, bowl.y, 20, bowl.x, bowl.y, bowl.rx);
    glow.addColorStop(0, "#fffdf3");
    glow.addColorStop(0.72, "#ded8c7");
    glow.addColorStop(1, "#958c7e");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(bowl.x, bowl.y, bowl.rx, bowl.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f5f0df";
    ctx.lineWidth = 12;
    ctx.stroke();

    const drawRice = (x, y, rotation, selected = false) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = selected ? "#9edcff" : "#fffcef";
      ctx.shadowColor = selected ? "#2699e8" : "rgba(80,55,20,.2)";
      ctx.shadowBlur = selected ? 12 : 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.2, 1.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    riceRef.current.forEach((rice) => {
      if (rice.place === "held") return;
      const x = rice.place === "bowl" ? bowl.x + rice.bx * bowl.rx : rice.x * w;
      const y = rice.place === "bowl" ? bowl.y + rice.by * bowl.ry : rice.y * h;
      drawRice(x, y, rice.rotation);
    });

    const pointer = game.pointer;
    if (game.held !== null) {
      drawRice(pointer.x * w, pointer.y * h + 23, game.heldRotation, true);
      ctx.strokeStyle = "rgba(53,171,255,.8)";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.ellipse(pointer.x * w, pointer.y * h + 48, 13, 5, game.heldRotation, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = "#6d4b27";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    [-7, 7].forEach((dx) => {
      ctx.beginPath();
      ctx.moveTo(pointer.x * w + dx - 35, pointer.y * h - 105);
      ctx.lineTo(pointer.x * w + dx, pointer.y * h + 15);
      ctx.stroke();
    });
  }, [game]);

  useEffect(() => {
    paint();
  }, [paint]);

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };

  const onMove = (event) => {
    const p = point(event);
    if (dragRef.current === "bowl") {
      setGame((g) => ({ ...g, bowl: p, pointer: p }));
    } else {
      setGame((g) => ({ ...g, pointer: p }));
    }
  };

  const onDown = (event) => {
    const p = point(event);
    const dx = p.x - game.bowl.x;
    const dy = p.y - game.bowl.y;
    if (event.shiftKey && Math.hypot(dx, dy) < 0.2) {
      dragRef.current = "bowl";
      canvasRef.current.setPointerCapture(event.pointerId);
      return;
    }
    if (game.held !== null) {
      const rice = riceRef.current[game.held];
      const inBowl = Math.hypot(dx / 0.25, dy / 0.25) < 1;
      Object.assign(rice, inBowl ? { place: "bowl", bx: dx / 0.25, by: dy / 0.25 } : { place: "desk", x: p.x, y: p.y }, { rotation: game.heldRotation });
      setGame((g) => ({ ...g, held: null }));
      return;
    }
    const candidates = riceRef.current.filter((rice) => rice.place === "bowl");
    if (candidates.length) {
      const rice = candidates[random(0, candidates.length - 1)];
      rice.place = "held";
      setGame((g) => ({ ...g, held: rice.id, heldRotation: rice.rotation, moved: g.moved + 1 }));
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      onPointerMove={onMove}
      onPointerDown={onDown}
      onPointerUp={() => (dragRef.current = null)}
      onWheel={(event) => {
        if (game.held === null) return;
        event.preventDefault();
        setGame((g) => ({ ...g, heldRotation: g.heldRotation + Math.sign(event.deltaY) * 0.18 }));
      }}
    />
  );
}

export default function Home() {
  const [screen, setScreen] = useState("home");
  const [game, setGame] = useState(null);
  const [digits, setDigits] = useState([0, 0, 0, 0]);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);
  const [name, setName] = useState("");
  const [scores, setScores] = useState([]);
  const [rankMode, setRankMode] = useState("easy");

  useEffect(() => {
    if (screen !== "game" || result) return;
    const timer = setInterval(() => setElapsed((Date.now() - game.startedAt) / 1000), 33);
    return () => clearInterval(timer);
  }, [screen, game?.startedAt, result]);

  const refreshScores = useCallback(async () => {
    try {
      setScores(await loadScores(rankMode));
    } catch {
      setScores([]);
    }
  }, [rankMode]);

  useEffect(() => {
    if (screen === "rank") refreshScores();
  }, [screen, refreshScores]);

  const start = (difficulty) => {
    const mode = MODES[difficulty];
    setDigits([0, 0, 0, 0]);
    setElapsed(0);
    setResult(null);
    setGame({
      id: Date.now(),
      difficulty,
      answer: random(mode.min, mode.max),
      startedAt: Date.now(),
      bowl: { x: 0.48, y: 0.52 },
      pointer: { x: 0.72, y: 0.38 },
      held: null,
      heldRotation: 0,
      moved: 0
    });
    setScreen("game");
  };

  const submit = () => {
    const guess = Number(digits.join(""));
    if (guess === game.answer) {
      setElapsed((Date.now() - game.startedAt) / 1000);
      setResult("success");
    } else {
      setResult(guess < game.answer ? "low" : "high");
      setTimeout(() => setResult(null), 1200);
    }
  };

  const register = async () => {
    if (!name.trim()) return;
    await saveScore({ name: name.trim(), difficulty: game.difficulty, seconds: elapsed });
    setRankMode(game.difficulty);
    setName("");
    setScreen("rank");
  };

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => setScreen("home")}>
          <span className="brand-mark">米</span>
          <span>한 톨의 시간<small>RICE COUNT</small></span>
        </button>
        <nav>
          <button onClick={() => setScreen("guide")}>게임 방법</button>
          <button onClick={() => setScreen("rank")}>랭킹</button>
        </nav>
      </header>

      {screen === "home" && (
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">고요한 집중 · 단순한 도전</p>
            <h1>이 그릇에는<br /><em>몇 톨</em>이 담겼을까?</h1>
            <p>젓가락으로 한 톨씩 옮기고, 당신만의 방식으로 세어보세요.<br />가장 단순하고도 집요한 관찰 게임.</p>
            <button className="primary" onClick={() => setScreen("difficulty")}>게임 시작 <span>→</span></button>
            <button className="text-button" onClick={() => setScreen("guide")}>게임 방법 보기</button>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="sun" />
            <div className="bowl-art"><div className="rice-pile">••••••••••<br />••••••••••••<br />•••••••••</div></div>
            <div className="sticks-art" />
          </div>
          <div className="scroll-note">SCROLL TO DISCOVER <span>↓</span></div>
        </section>
      )}

      {screen === "difficulty" && (
        <section className="panel">
          <p className="eyebrow">난이도 선택</p>
          <h2>얼마나 깊이 집중하시겠어요?</h2>
          <div className="mode-grid">
            {Object.entries(MODES).map(([key, mode], index) => (
              <button className="mode-card" key={key} onClick={() => start(key)}>
                <span>0{index + 1}</span><h3>{mode.label}</h3><p>{mode.range}톨</p><i>선택 →</i>
              </button>
            ))}
          </div>
          <button className="text-button" onClick={() => setScreen("home")}>← 돌아가기</button>
        </section>
      )}

      {screen === "game" && game && (
        <section className="game-layout">
          <div className="game-stage">
            <div className="game-hud">
              <span>{MODES[game.difficulty].label} · {MODES[game.difficulty].range}톨</span>
              <strong>{formatTime(elapsed)}</strong>
            </div>
            <RiceCanvas game={game} setGame={setGame} />
            <div className="controls-note">클릭: 집기/놓기 · 휠: 쌀알 회전 · Shift+드래그: 그릇 이동</div>
          </div>
          <aside className="answer-panel">
            <p className="eyebrow">당신의 답</p>
            <h2>몇 톨일까요?</h2>
            <div className="digits">
              {digits.map((digit, index) => (
                <div className="digit" key={index}>
                  <button onClick={() => setDigits((d) => d.map((v, i) => i === index ? (v + 1) % 10 : v))}>⌃</button>
                  <b>{digit}</b>
                  <button onClick={() => setDigits((d) => d.map((v, i) => i === index ? (v + 9) % 10 : v))}>⌄</button>
                </div>
              ))}
            </div>
            <button className="primary full" onClick={submit}>정답 확인</button>
            <p className="moved">옮겨 본 쌀알 <b>{game.moved}</b>톨</p>
            {(result === "low" || result === "high") && <div className="toast">조금 더 {result === "low" ? "많아요" : "적어요"}.</div>}
          </aside>
          {result === "success" && (
            <div className="modal-backdrop">
              <div className="modal">
                <p className="eyebrow">정답입니다</p>
                <h2>{game.answer.toLocaleString()}톨</h2>
                <p>기록 <strong>{formatTime(elapsed)}</strong></p>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={12} placeholder="랭킹에 남길 이름" />
                <button className="primary full" onClick={register}>기록 등록</button>
              </div>
            </div>
          )}
        </section>
      )}

      {screen === "guide" && (
        <section className="panel guide">
          <p className="eyebrow">게임 방법</p><h2>천천히, 한 톨씩.</h2>
          <div className="guide-grid">
            <article><span>01</span><h3>난이도를 고르세요</h3><p>난이도에 따라 그릇에 담기는 쌀알 수가 달라집니다.</p></article>
            <article><span>02</span><h3>쌀알을 나누세요</h3><p>젓가락으로 쌀알을 집어 책상이나 그릇에 놓으세요. 휠로 회전할 수 있습니다.</p></article>
            <article><span>03</span><h3>정답을 입력하세요</h3><p>네 자리 숫자를 자리별로 조절해 제출하면 시간이 기록됩니다.</p></article>
          </div>
          <button className="primary" onClick={() => setScreen("difficulty")}>도전 시작</button>
        </section>
      )}

      {screen === "rank" && (
        <section className="panel rank">
          <p className="eyebrow">명예의 기록</p><h2>가장 빠른 관찰자들</h2>
          <div className="tabs">
            {Object.entries(MODES).map(([key, mode]) => <button className={rankMode === key ? "active" : ""} onClick={() => setRankMode(key)} key={key}>{mode.label}</button>)}
          </div>
          <div className="score-list">
            {scores.length ? scores.map((score, index) => (
              <div key={score.id || `${score.name}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b><span>{score.name}</span><strong>{formatTime(score.seconds)}</strong></div>
            )) : <p className="empty">아직 기록이 없습니다. 첫 번째 관찰자가 되어보세요.</p>}
          </div>
          <small className="storage-note">{firebaseEnabled ? "Firebase 전 세계 랭킹" : "Firebase 미설정 · 이 브라우저에 기록 저장 중"}</small>
        </section>
      )}
      <footer>© 2026 RICE COUNT · A QUIET COUNTING GAME</footer>
    </main>
  );
}
