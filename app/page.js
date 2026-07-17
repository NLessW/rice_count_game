'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    firebaseEnabled,
    clearGameState,
    loadGameState,
    loadMyResults,
    loadScores,
    logIn,
    logOut,
    observeAuth,
    recordGameResult,
    saveScore,
    saveGameState,
    signUp,
} from '@/lib/firebase';

const MODES = {
    easy: { label: '쉬움', range: '1,000–2,000', min: 1000, max: 2000 },
    normal: { label: '보통', range: '2,000–4,000', min: 2000, max: 4000 },
    hard: { label: '어려움', range: '4,000–8,000', min: 4000, max: 8000 },
};

const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const formatTime = (seconds) => {
    const wholeSeconds = Math.floor(seconds);
    return `${String(Math.floor(wholeSeconds / 3600)).padStart(2, '0')}:${String(Math.floor((wholeSeconds % 3600) / 60)).padStart(2, '0')}:${String(wholeSeconds % 60).padStart(2, '0')}`;
};

const giveUpTaunt = (seconds) => {
    if (seconds < 60) {
        return '기억력이 짧다는 금붕어도 1분은 더 버티겠는데, 벌써 정답을 보시려고요?';
    }
    if (seconds < 180) {
        return '비둘기도 먹이를 찾을 때는 이것보다 오래 집중합니다. 설마 여기서 끝인가요?';
    }
    if (seconds < 300) {
        return '나무늘보도 느릴 뿐 멈추지는 않는데, 먼저 포기해버리실 건가요?';
    }
    return '시간을 이만큼이나 들여놓고 마지막 결론이 포기라니, 정말 이대로 끝낼 건가요?';
};

function RiceCanvas({ game, setGame, riceApiRef }) {
    const canvasRef = useRef(null);
    const sceneRef = useRef(null);
    const sceneDirtyRef = useRef(true);
    const dragRef = useRef(null);
    const riceRef = useRef([]);

    riceApiRef.current = {
        serialize: () =>
            riceRef.current.flatMap((rice) => {
                const place = rice.place === 'bowl' ? 0 : rice.place === 'desk' ? 1 : 2;
                const first = rice.place === 'bowl' ? rice.bx : rice.x || 0;
                const second = rice.place === 'bowl' ? rice.by : rice.y || 0;
                return [
                    place,
                    Number(first.toFixed(5)),
                    Number(second.toFixed(5)),
                    Number(rice.rotation.toFixed(5)),
                ];
            }),
    };

    useEffect(() => {
        if (!game) return;
        if (game.riceData?.length) {
            riceRef.current = Array.from(
                { length: game.riceData.length / 4 },
                (_, id) => {
                    const offset = id * 4;
                    const placeCode = game.riceData[offset];
                    const place = placeCode === 0 ? 'bowl' : placeCode === 1 ? 'desk' : 'held';
                    const rice = {
                        id,
                        place,
                        rotation: game.riceData[offset + 3],
                    };
                    if (place === 'bowl') {
                        rice.bx = game.riceData[offset + 1];
                        rice.by = game.riceData[offset + 2];
                    } else {
                        rice.x = game.riceData[offset + 1];
                        rice.y = game.riceData[offset + 2];
                    }
                    return rice;
                },
            );
            sceneDirtyRef.current = true;
            return;
        }
        const seeded = Array.from({ length: game.answer }, (_, id) => {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.sqrt(Math.random()) * 0.82;
            return {
                id,
                bx: Math.cos(angle) * radius,
                by: Math.sin(angle) * radius,
                rotation: Math.random() * Math.PI,
                place: 'bowl',
            };
        });
        riceRef.current = seeded;
        sceneDirtyRef.current = true;
    }, [game?.id, game?.riceData]);

    const findRiceAt = (p, currentGame, rect) => {
        const bowlRx = Math.min(rect.width * 0.25, 210);
        const bowlRy = Math.min(rect.height * 0.25, 145);
        const clickX = p.x * rect.width;
        const clickY = p.y * rect.height;

        // 나중에 그린 쌀알부터 검사해 화면에서 가장 위에 보이는 한 톨을 고른다.
        for (let index = riceRef.current.length - 1; index >= 0; index -= 1) {
            const rice = riceRef.current[index];
            if (rice.place !== 'bowl' && rice.place !== 'desk') continue;
            const x =
                rice.place === 'bowl'
                    ? currentGame.bowl.x * rect.width + rice.bx * bowlRx
                    : rice.x * rect.width;
            const y =
                rice.place === 'bowl'
                    ? currentGame.bowl.y * rect.height + rice.by * bowlRy
                    : rice.y * rect.height;
            if (Math.hypot(clickX - x, clickY - y) <= 8) return { rice, x, y };
        }

        return null;
    };

    const paint = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !game) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (
            canvas.width !== rect.width * dpr ||
            canvas.height !== rect.height * dpr
        ) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
        }
        const w = rect.width;
        const h = rect.height;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const bowl = {
            x: game.bowl.x * w,
            y: game.bowl.y * h,
            rx: Math.min(w * 0.25, 210),
            ry: Math.min(h * 0.25, 145),
        };

        const drawRice = (target, x, y, rotation, selected = false) => {
            target.save();
            target.translate(x, y);
            target.rotate(rotation);
            target.fillStyle = selected ? '#9edcff' : '#fffcef';
            target.shadowColor = selected ? '#2699e8' : 'rgba(80,55,20,.2)';
            target.shadowBlur = selected ? 12 : 2;
            target.beginPath();
            target.ellipse(0, 0, 5.6, 2.2, 0, 0, Math.PI * 2);
            target.fill();
            target.restore();
        };

        if (!sceneRef.current)
            sceneRef.current = document.createElement('canvas');
        const scene = sceneRef.current;
        if (scene.width !== canvas.width || scene.height !== canvas.height) {
            scene.width = canvas.width;
            scene.height = canvas.height;
            sceneDirtyRef.current = true;
        }

        if (sceneDirtyRef.current) {
            const sceneCtx = scene.getContext('2d');
            sceneCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            sceneCtx.clearRect(0, 0, w, h);
            const glow = sceneCtx.createRadialGradient(
                bowl.x,
                bowl.y,
                20,
                bowl.x,
                bowl.y,
                bowl.rx,
            );
            glow.addColorStop(0, '#fffdf3');
            glow.addColorStop(0.72, '#ded8c7');
            glow.addColorStop(1, '#958c7e');
            sceneCtx.fillStyle = glow;
            sceneCtx.beginPath();
            sceneCtx.ellipse(
                bowl.x,
                bowl.y,
                bowl.rx,
                bowl.ry,
                0,
                0,
                Math.PI * 2,
            );
            sceneCtx.fill();
            sceneCtx.strokeStyle = '#f5f0df';
            sceneCtx.lineWidth = 12;
            sceneCtx.stroke();

            riceRef.current.forEach((rice) => {
                if (rice.place === 'held') return;
                const x =
                    rice.place === 'bowl'
                        ? bowl.x + rice.bx * bowl.rx
                        : rice.x * w;
                const y =
                    rice.place === 'bowl'
                        ? bowl.y + rice.by * bowl.ry
                        : rice.y * h;
                drawRice(sceneCtx, x, y, rice.rotation);
            });
            sceneDirtyRef.current = false;
        }

        ctx.drawImage(scene, 0, 0, w, h);

        const pointer = game.pointer;
        const target =
            game.held === null ? findRiceAt(pointer, game, rect) : null;
        if (target) {
            ctx.save();
            ctx.strokeStyle = 'rgba(82, 211, 255, .95)';
            ctx.shadowColor = '#39c8ff';
            ctx.shadowBlur = 10;
            ctx.lineWidth = 1.5;
            ctx.translate(target.x, target.y);
            ctx.rotate(target.rice.rotation);
            ctx.beginPath();
            ctx.ellipse(0, 0, 8.5, 4.2, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        if (game.held !== null) {
            drawRice(
                ctx,
                pointer.x * w,
                pointer.y * h,
                game.heldRotation,
                true,
            );
            ctx.strokeStyle = 'rgba(53,171,255,.8)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.ellipse(
                pointer.x * w,
                pointer.y * h,
                6.6,
                3,
                game.heldRotation,
                0,
                Math.PI * 2,
            );
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 젓가락 끝에서 바닥의 실제 클릭 지점까지 수직 레이저를 내린다.
        const aimX = pointer.x * w;
        const aimY = pointer.y * h;
        const laser = ctx.createLinearGradient(aimX, aimY - 24, aimX, aimY);
        laser.addColorStop(0, 'rgba(82, 211, 255, .3)');
        laser.addColorStop(1, 'rgba(82, 211, 255, 1)');
        ctx.save();
        ctx.strokeStyle = laser;
        ctx.fillStyle = target ? '#9be8ff' : 'rgba(82, 211, 255, .85)';
        ctx.shadowColor = '#39c8ff';
        ctx.shadowBlur = target ? 12 : 7;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(aimX, aimY - 24);
        ctx.lineTo(aimX, aimY);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(aimX, aimY, target ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = '#6d4b27';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        [-7, 7].forEach((dx) => {
            ctx.beginPath();
            ctx.moveTo(pointer.x * w + dx - 35, pointer.y * h - 144);
            ctx.lineTo(pointer.x * w + dx, pointer.y * h - 24);
            ctx.stroke();
        });
    }, [game]);

    useEffect(() => {
        paint();
    }, [paint]);

    const point = (event) => {
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) / rect.width,
            y: (event.clientY - rect.top) / rect.height,
        };
    };

    const placeRice = (p) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const grain = { x: p.x, y: p.y };

        sceneDirtyRef.current = true;
        setGame((g) => {
            if (!g || g.held === null) return g;

            const rice = riceRef.current[g.held];
            const bowlRx = Math.min(rect.width * 0.25, 210) / rect.width;
            const bowlRy = Math.min(rect.height * 0.25, 145) / rect.height;
            const dx = grain.x - g.bowl.x;
            const dy = grain.y - g.bowl.y;
            const inBowl = (dx / bowlRx) ** 2 + (dy / bowlRy) ** 2 < 1;

            Object.assign(
                rice,
                inBowl
                    ? { place: 'bowl', bx: dx / bowlRx, by: dy / bowlRy }
                    : { place: 'desk', x: grain.x, y: grain.y },
                { rotation: g.heldRotation },
            );

            return { ...g, held: null, moved: g.moved + (inBowl ? 0 : 1) };
        });
    };

    const onMove = (event) => {
        const p = point(event);
        if (dragRef.current === 'bowl') {
            sceneDirtyRef.current = true;
            setGame((g) => ({ ...g, bowl: p, pointer: p }));
        } else {
            if (
                dragRef.current?.type === 'rice' &&
                Math.hypot(
                    p.x - dragRef.current.start.x,
                    p.y - dragRef.current.start.y,
                ) > 0.008
            ) {
                dragRef.current.moved = true;
            }
            setGame((g) => ({ ...g, pointer: p }));
        }
    };

    const onDown = (event) => {
        const p = point(event);
        const dx = p.x - game.bowl.x;
        const dy = p.y - game.bowl.y;
        if (event.shiftKey && Math.hypot(dx, dy) < 0.2) {
            dragRef.current = 'bowl';
            canvasRef.current.setPointerCapture(event.pointerId);
            return;
        }
        actAt(p, event);
    };

    const actAt = (p, pointerEvent = null) => {
        if (game.held !== null) {
            placeRice(p);
            return;
        }
        const rect = canvasRef.current.getBoundingClientRect();
        const target = findRiceAt(p, game, rect);
        const rice = target?.rice;

        if (rice) {
            const wasOnDesk = rice.place === 'desk';
            rice.place = 'held';
            sceneDirtyRef.current = true;
            if (pointerEvent) {
                dragRef.current = { type: 'rice', start: p, moved: false };
                canvasRef.current.setPointerCapture(pointerEvent.pointerId);
            }
            setGame((g) => ({
                ...g,
                pointer: p,
                held: rice.id,
                heldRotation: rice.rotation,
                moved: wasOnDesk ? Math.max(0, g.moved - 1) : g.moved,
            }));
        }
    };

    Object.assign(riceApiRef.current, {
        action: () => actAt(game.pointer),
        moveAim: (dx, dy) =>
            setGame((g) => ({
                ...g,
                pointer: {
                    x: Math.max(0.02, Math.min(0.98, g.pointer.x + dx)),
                    y: Math.max(0.08, Math.min(0.98, g.pointer.y + dy)),
                },
            })),
        moveBowl: (dx, dy) => {
            sceneDirtyRef.current = true;
            setGame((g) => {
                const bowl = {
                    x: Math.max(0.22, Math.min(0.78, g.bowl.x + dx)),
                    y: Math.max(0.25, Math.min(0.78, g.bowl.y + dy)),
                };
                return { ...g, bowl, pointer: bowl };
            });
        },
        rotate: (amount) =>
            setGame((g) =>
                g.held === null
                    ? g
                    : { ...g, heldRotation: g.heldRotation + amount },
            ),
    });

    const onUp = (event) => {
        if (dragRef.current?.type === 'rice' && dragRef.current.moved) {
            placeRice(point(event));
        }
        dragRef.current = null;
    };

    return (
        <canvas
            ref={canvasRef}
            className="game-canvas"
            onPointerMove={onMove}
            onPointerDown={onDown}
            onPointerUp={onUp}
            onWheel={(event) => {
                if (game.held === null) return;
                event.preventDefault();
                setGame((g) => ({
                    ...g,
                    heldRotation:
                        g.heldRotation + Math.sign(event.deltaY) * 0.18,
                }));
            }}
        />
    );
}

function MobileControls({ riceApiRef }) {
    const directionRef = useRef({ x: 0, y: 0 });
    const rotatingRef = useRef(false);
    const bowlModeRef = useRef(false);
    const [knob, setKnob] = useState({ x: 0, y: 0 });
    const [bowlMode, setBowlMode] = useState(false);

    useEffect(() => {
        let frame;
        const tick = () => {
            const direction = directionRef.current;
            if (direction.x || direction.y) {
                const method = bowlModeRef.current ? 'moveBowl' : 'moveAim';
                riceApiRef.current?.[method](
                    direction.x * 0.006,
                    direction.y * 0.006,
                );
            }
            if (rotatingRef.current) riceApiRef.current?.rotate(0.07);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [riceApiRef]);

    const moveStick = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - (rect.left + rect.width / 2);
        const y = event.clientY - (rect.top + rect.height / 2);
        const distance = Math.hypot(x, y);
        const radius = 34;
        const scale = distance > radius ? radius / distance : 1;
        const next = { x: x * scale, y: y * scale };
        setKnob(next);
        directionRef.current = { x: next.x / radius, y: next.y / radius };
    };

    const releaseStick = () => {
        directionRef.current = { x: 0, y: 0 };
        setKnob({ x: 0, y: 0 });
    };

    return (
        <div className="mobile-controls">
            <div
                className="joystick"
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    moveStick(event);
                }}
                onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        moveStick(event);
                    }
                }}
                onPointerUp={releaseStick}
                onPointerCancel={releaseStick}>
                <span
                    className="joystick-knob"
                    style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
                />
            </div>
            <div className="mobile-actions">
                <button
                    className={`bowl-control${bowlMode ? ' active' : ''}`}
                    onPointerDown={(event) => {
                        event.preventDefault();
                        const next = !bowlModeRef.current;
                        bowlModeRef.current = next;
                        setBowlMode(next);
                    }}>
                    ◉<small>그릇 이동</small>
                </button>
                <button
                    className="rotate-control"
                    onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        rotatingRef.current = true;
                    }}
                    onPointerUp={() => (rotatingRef.current = false)}
                    onPointerCancel={() => (rotatingRef.current = false)}>
                    ↻<small>누르고 회전</small>
                </button>
                <button
                    className="action-control"
                    onPointerDown={(event) => {
                        event.preventDefault();
                        riceApiRef.current?.action();
                    }}>
                    집기<small>놓기</small>
                </button>
            </div>
        </div>
    );
}

export default function Home() {
    const [screen, setScreen] = useState('home');
    const [game, setGame] = useState(null);
    const [digits, setDigits] = useState([0, 0, 0, 0]);
    const [elapsed, setElapsed] = useState(0);
    const [result, setResult] = useState(null);
    const [scores, setScores] = useState([]);
    const [rankMode, setRankMode] = useState('easy');
    const [giveUpStep, setGiveUpStep] = useState(0);
    const [user, setUser] = useState(null);
    const [authMode, setAuthMode] = useState('login');
    const [authForm, setAuthForm] = useState({
        name: '',
        email: '',
        password: '',
        passwordConfirm: '',
    });
    const [authError, setAuthError] = useState('');
    const [authBusy, setAuthBusy] = useState(false);
    const [myResults, setMyResults] = useState([]);
    const [savedGame, setSavedGame] = useState(null);
    const [saveStatus, setSaveStatus] = useState('');
    const [guestName, setGuestName] = useState('');
    const riceApiRef = useRef(null);

    useEffect(() => observeAuth(setUser), []);

    useEffect(() => {
        if (!user) {
            setSavedGame(null);
            return;
        }
        loadGameState(user.uid).then(setSavedGame).catch(() => setSavedGame(null));
        if (screen === 'account') {
            loadMyResults(user.uid).then(setMyResults).catch(() => setMyResults([]));
        }
    }, [screen, user]);

    useEffect(() => {
        if (screen !== 'game' || result) return;
        const timer = setInterval(
            () => setElapsed((Date.now() - game.startedAt) / 1000),
            250,
        );
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
        if (screen === 'rank') refreshScores();
    }, [screen, refreshScores]);

    const start = (difficulty) => {
        const mode = MODES[difficulty];
        setDigits([0, 0, 0, 0]);
        setElapsed(0);
        setResult(null);
        setGiveUpStep(0);
        setGame({
            id: Date.now(),
            difficulty,
            answer: random(mode.min, mode.max),
            startedAt: Date.now(),
            bowl: { x: 0.48, y: 0.52 },
            pointer: { x: 0.72, y: 0.38 },
            held: null,
            heldRotation: 0,
            moved: 0,
        });
        setScreen('game');
    };

    const submit = () => {
        const guess = Number(digits.join(''));
        if (guess === game.answer) {
            const finalTime = (Date.now() - game.startedAt) / 1000;
            setElapsed(finalTime);
            setResult('success');
            if (user) {
                recordGameResult({
                    difficulty: game.difficulty,
                    won: true,
                    seconds: finalTime,
                }).catch(() => {});
                clearGameState(user.uid).catch(() => {});
                setSavedGame(null);
            }
        } else {
            setResult('wrong');
            setTimeout(
                () =>
                    setResult((current) =>
                        current === 'wrong' ? null : current,
                    ),
                1200,
            );
        }
    };

    const giveUp = () => {
        const finalTime = (Date.now() - game.startedAt) / 1000;
        setElapsed(finalTime);
        setGiveUpStep(0);
        setResult('giveup');
        if (user) {
            recordGameResult({
                difficulty: game.difficulty,
                won: false,
                seconds: finalTime,
            }).catch(() => {});
            clearGameState(user.uid).catch(() => {});
            setSavedGame(null);
        }
    };

    const register = async () => {
        const playerName = user
            ? user.displayName || user.email?.split('@')[0] || '관찰자'
            : guestName.trim();
        if (!playerName) return;
        await saveScore({
            name: playerName,
            difficulty: game.difficulty,
            seconds: elapsed,
        });
        setRankMode(game.difficulty);
        setGuestName('');
        setScreen('rank');
    };

    const saveCurrentGame = async () => {
        if (!user || !game || !riceApiRef.current) return;
        setSaveStatus('저장 중...');
        try {
            const currentElapsed = (Date.now() - game.startedAt) / 1000;
            const state = {
                difficulty: game.difficulty,
                answer: game.answer,
                elapsed: Number(currentElapsed.toFixed(3)),
                bowl: game.bowl,
                pointer: game.pointer,
                held: game.held,
                heldRotation: game.heldRotation,
                moved: game.moved,
                riceData: riceApiRef.current.serialize(),
            };
            await saveGameState(user.uid, state);
            setSavedGame(state);
            setSaveStatus('저장되었습니다.');
        } catch {
            setSaveStatus('저장에 실패했습니다.');
        }
    };

    const resumeSavedGame = () => {
        if (!savedGame) return;
        setDigits([0, 0, 0, 0]);
        setElapsed(savedGame.elapsed);
        setResult(null);
        setGiveUpStep(0);
        setSaveStatus('');
        setGame({
            id: Date.now(),
            difficulty: savedGame.difficulty,
            answer: savedGame.answer,
            startedAt: Date.now() - savedGame.elapsed * 1000,
            bowl: savedGame.bowl,
            pointer: savedGame.pointer,
            held: savedGame.held,
            heldRotation: savedGame.heldRotation,
            moved: savedGame.moved,
            riceData: savedGame.riceData,
        });
        setScreen('game');
    };

    const submitAuth = async (event) => {
        event.preventDefault();
        if (
            authMode === 'signup' &&
            authForm.password !== authForm.passwordConfirm
        ) {
            setAuthError('비밀번호가 서로 일치하지 않습니다.');
            return;
        }
        setAuthBusy(true);
        setAuthError('');
        try {
            const authenticated = authMode === 'signup'
                ? await signUp(authForm)
                : await logIn(authForm);
            setUser(authenticated);
            setAuthForm({
                name: '',
                email: '',
                password: '',
                passwordConfirm: '',
            });
            setScreen(result === 'success' ? 'game' : 'account');
        } catch (error) {
            const code = error?.code || '';
            setAuthError(
                code.includes('email-already-in-use')
                    ? '이미 사용 중인 이메일입니다.'
                    : code.includes('operation-not-allowed')
                      ? 'Firebase에서 이메일/비밀번호 로그인을 활성화해 주세요.'
                      : code.includes('unauthorized-domain')
                        ? '현재 도메인이 Firebase Authentication 승인 목록에 없습니다.'
                        : code.includes('invalid-api-key')
                          ? 'Firebase API 키 설정이 올바르지 않습니다.'
                    : code.includes('invalid-credential')
                      ? '이메일 또는 비밀번호가 올바르지 않습니다.'
                      : code.includes('weak-password')
                        ? '비밀번호는 6자 이상이어야 합니다.'
                        : `인증에 실패했습니다. (${code || 'unknown'})`,
            );
        } finally {
            setAuthBusy(false);
        }
    };

    const wins = myResults.filter((item) => item.won);
    const winRate = myResults.length
        ? Math.round((wins.length / myResults.length) * 100)
        : 0;
    const difficultyStats = Object.fromEntries(
        Object.keys(MODES).map((difficulty) => {
            const records = wins
                .filter((item) => item.difficulty === difficulty)
                .map((item) => item.seconds);
            return [
                difficulty,
                {
                    count: records.length,
                    best: records.length ? Math.min(...records) : null,
                    average: records.length
                        ? records.reduce((sum, value) => sum + value, 0) /
                          records.length
                        : null,
                },
            ];
        }),
    );

    return (
        <main>
            <header className="topbar">
                <button className="brand" onClick={() => setScreen('home')}>
                    <span className="brand-mark">米</span>
                    <span>
                        한 톨의 시간<small>RICE COUNT</small>
                    </span>
                </button>
                <nav>
                    <button onClick={() => setScreen('guide')}>
                        게임 방법
                    </button>
                    <button onClick={() => setScreen('rank')}>랭킹</button>
                    <button onClick={() => setScreen(user ? 'account' : 'auth')}>
                        {user ? '내 정보' : '로그인'}
                    </button>
                </nav>
            </header>

            {screen === 'home' && (
                <section className="hero">
                    <div className="hero-copy">
                        <p className="eyebrow">고요한 집중 · 단순한 도전</p>
                        <h1>
                            이 그릇에는
                            <br />
                            <em>몇 톨</em>이 담겼을까?
                        </h1>
                        <p>
                            젓가락으로 한 톨씩 옮기고, 당신만의 방식으로
                            세어보세요.
                            <br />
                            가장 단순하고도 집요한 관찰 게임.
                        </p>
                        <button
                            className="primary"
                            onClick={() => setScreen('difficulty')}>
                            게임 시작 <span>→</span>
                        </button>
                        <button
                            className="text-button"
                            onClick={() => setScreen('guide')}>
                            게임 방법 보기
                        </button>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                        <div className="sun" />
                        <img
                            className="bowl-image"
                            src="images/rice-bowl-hero.png"
                            alt=""
                        />
                        <div className="sticks-art" />
                    </div>
                    <div className="scroll-note">
                        SCROLL TO DISCOVER <span>↓</span>
                    </div>
                </section>
            )}

            {screen === 'difficulty' && (
                <section className="panel">
                    <p className="eyebrow">난이도 선택</p>
                    <h2>내 집중력은 어느정도일까요?</h2>
                    {user && savedGame && (
                        <div className="saved-game-card start-save-card">
                            <div>
                                <p className="eyebrow">저장된 게임</p>
                                <h3>
                                    {MODES[savedGame.difficulty]?.label} ·{' '}
                                    {formatTime(savedGame.elapsed)}부터
                                </h3>
                                <p>쌀알과 그릇 위치까지 저장한 상태로 이어집니다.</p>
                            </div>
                            <button className="primary" onClick={resumeSavedGame}>
                                이어서 하기
                            </button>
                        </div>
                    )}
                    <div className="mode-grid">
                        {Object.entries(MODES).map(([key, mode], index) => (
                            <button
                                className="mode-card"
                                key={key}
                                onClick={() => start(key)}>
                                <span>0{index + 1}</span>
                                <h3>{mode.label}</h3>
                                <i>선택 →</i>
                            </button>
                        ))}
                    </div>
                    <button
                        className="text-button"
                        onClick={() => setScreen('home')}>
                        ← 돌아가기
                    </button>
                </section>
            )}

            {screen === 'auth' && (
                <section className="panel auth-panel">
                    <p className="eyebrow">
                        {authMode === 'login' ? '어서 오세요' : '새로운 관찰자'}
                    </p>
                    <h2>{authMode === 'login' ? '로그인' : '회원가입'}</h2>
                    <form className="auth-form" onSubmit={submitAuth}>
                        {authMode === 'signup' && (
                            <input
                                value={authForm.name}
                                onChange={(event) =>
                                    setAuthForm((form) => ({
                                        ...form,
                                        name: event.target.value,
                                    }))
                                }
                                maxLength={12}
                                required
                                placeholder="이름"
                            />
                        )}
                        <input
                            type="email"
                            value={authForm.email}
                            onChange={(event) =>
                                setAuthForm((form) => ({
                                    ...form,
                                    email: event.target.value,
                                }))
                            }
                            required
                            placeholder="이메일"
                        />
                        <input
                            type="password"
                            value={authForm.password}
                            onChange={(event) =>
                                setAuthForm((form) => ({
                                    ...form,
                                    password: event.target.value,
                                }))
                            }
                            minLength={6}
                            required
                            placeholder="비밀번호 (6자 이상)"
                        />
                        {authMode === 'signup' && (
                            <input
                                type="password"
                                value={authForm.passwordConfirm}
                                onChange={(event) =>
                                    setAuthForm((form) => ({
                                        ...form,
                                        passwordConfirm: event.target.value,
                                    }))
                                }
                                minLength={6}
                                required
                                placeholder="비밀번호 확인"
                            />
                        )}
                        {authError && <div className="toast">{authError}</div>}
                        <button className="primary full" disabled={authBusy}>
                            {authBusy
                                ? '처리 중...'
                                : authMode === 'login'
                                  ? '로그인'
                                  : '가입하기'}
                        </button>
                    </form>
                    <button
                        className="text-button"
                        onClick={() => {
                            setAuthError('');
                            setAuthMode((mode) =>
                                mode === 'login' ? 'signup' : 'login',
                            );
                        }}>
                        {authMode === 'login'
                            ? '처음이신가요? 회원가입'
                            : '이미 계정이 있나요? 로그인'}
                    </button>
                </section>
            )}

            {screen === 'account' && user && (
                <section className="panel account-panel">
                    <p className="eyebrow">나의 기록</p>
                    <h2>{user.displayName || '관찰자'}님의 대시보드</h2>
                    <div className="summary-grid">
                        <article>
                            <span>완료한 게임</span>
                            <strong>{myResults.length}</strong>
                        </article>
                        <article>
                            <span>정답 횟수</span>
                            <strong>{wins.length}</strong>
                        </article>
                        <article>
                            <span>승률</span>
                            <strong>{winRate}%</strong>
                        </article>
                    </div>
                    {savedGame && (
                        <div className="saved-game-card">
                            <div>
                                <p className="eyebrow">저장된 게임</p>
                                <h3>
                                    {MODES[savedGame.difficulty]?.label} ·{' '}
                                    {formatTime(savedGame.elapsed)}
                                </h3>
                            </div>
                            <button className="primary" onClick={resumeSavedGame}>
                                이어서 하기
                            </button>
                        </div>
                    )}
                    <div className="stats-grid">
                        {Object.entries(MODES).map(([key, mode]) => {
                            const stats = difficultyStats[key];
                            return (
                                <article key={key}>
                                    <p className="eyebrow">{mode.label}</p>
                                    <h3>{stats.count}회 정답</h3>
                                    <dl>
                                        <div>
                                            <dt>최고 시간</dt>
                                            <dd>
                                                {stats.best === null
                                                    ? '—'
                                                    : formatTime(stats.best)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>평균 시간</dt>
                                            <dd>
                                                {stats.average === null
                                                    ? '—'
                                                    : formatTime(stats.average)}
                                            </dd>
                                        </div>
                                    </dl>
                                </article>
                            );
                        })}
                    </div>
                    <button
                        className="text-button"
                        onClick={async () => {
                            await logOut();
                            setUser(null);
                            setScreen('home');
                        }}>
                        로그아웃
                    </button>
                </section>
            )}

            {screen === 'game' && game && (
                <section className="game-layout">
                    <div className="game-stage">
                        <div className="game-hud">
                            <span>{MODES[game.difficulty].label}</span>
                            <strong>{formatTime(elapsed)}</strong>
                        </div>
                        <RiceCanvas
                            game={game}
                            setGame={setGame}
                            riceApiRef={riceApiRef}
                        />
                        <MobileControls riceApiRef={riceApiRef} />
                        <div className="controls-note">
                            드래그 또는 클릭: 집기/놓기 · 휠: 쌀알 회전 ·
                            Shift+드래그: 그릇 이동
                        </div>
                    </div>
                    <aside className="answer-panel">
                        <p className="eyebrow">당신의 답</p>
                        <h2>몇 톨일까요?</h2>
                        <div className="digits">
                            {digits.map((digit, index) => (
                                <div className="digit" key={index}>
                                    <button
                                        onClick={() =>
                                            setDigits((d) =>
                                                d.map((v, i) =>
                                                    i === index
                                                        ? (v + 1) % 10
                                                        : v,
                                                ),
                                            )
                                        }>
                                        ⌃
                                    </button>
                                    <b>{digit}</b>
                                    <button
                                        onClick={() =>
                                            setDigits((d) =>
                                                d.map((v, i) =>
                                                    i === index
                                                        ? (v + 9) % 10
                                                        : v,
                                                ),
                                            )
                                        }>
                                        ⌄
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button className="primary full" onClick={submit}>
                            정답 확인
                        </button>
                        <button
                            className="text-button give-up"
                            onClick={() => setGiveUpStep(1)}>
                            포기하기
                        </button>
                        {user && (
                            <>
                                <button
                                    className="text-button save-game"
                                    onClick={saveCurrentGame}>
                                    중간 저장
                                </button>
                                {saveStatus && (
                                    <p className="save-status">{saveStatus}</p>
                                )}
                            </>
                        )}
                        {result === 'wrong' && (
                            <div className="toast">틀렸습니다.</div>
                        )}
                    </aside>
                    {giveUpStep > 0 && (
                        <div className="modal-backdrop">
                            <div className="modal give-up-modal">
                                <p className="eyebrow">
                                    포기 확인 {giveUpStep} / 2
                                </p>
                                <h2>
                                    {giveUpStep === 1
                                        ? '당신의 집중력은 겨우 그 정도란 건가요?'
                                        : '앞으로는 이것보다 힘든 일도 많을 텐데요?'}
                                </h2>
                                <p>
                                    {giveUpStep === 1
                                        ? giveUpTaunt(elapsed)
                                        : '쌀알 세기에서도 포기한다면 더 어려운 순간에는 어떻게 하시려고요? 그래도 정말 포기할 건가요?'}
                                </p>
                                <button
                                    className="primary full"
                                    onClick={() => setGiveUpStep(0)}>
                                    {giveUpStep === 1
                                        ? '다시 세어볼게요'
                                        : '자존심 지키러 돌아가기'}
                                </button>
                                <button
                                    className="text-button give-up"
                                    onClick={() =>
                                        giveUpStep === 1
                                            ? setGiveUpStep(2)
                                            : giveUp()
                                    }>
                                    {giveUpStep === 1
                                        ? '그래도 포기할래요'
                                        : '네, 정답 보여주세요'}
                                </button>
                            </div>
                        </div>
                    )}
                    {(result === 'success' || result === 'giveup') && (
                        <div className="modal-backdrop">
                            <div className="modal">
                                <p className="eyebrow">
                                    {result === 'success'
                                        ? '정답입니다'
                                        : '정답은'}
                                </p>
                                <h2>{game.answer.toLocaleString()}톨</h2>
                                {result === 'success' ? (
                                    <>
                                        <p>
                                            기록{' '}
                                            <strong>{formatTime(elapsed)}</strong>
                                        </p>
                                        {user ? (
                                            <>
                                                <p>
                                                    <strong>
                                                        {user.displayName ||
                                                            user.email}
                                                    </strong>
                                                    님의 기록으로 저장합니다.
                                                </p>
                                                <button
                                                    className="primary full"
                                                    onClick={register}>
                                                    기록 등록
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <p>
                                                    비회원 기록으로 사용할 이름을
                                                    입력해 주세요.
                                                </p>
                                                <input
                                                    value={guestName}
                                                    onChange={(event) =>
                                                        setGuestName(
                                                            event.target.value,
                                                        )
                                                    }
                                                    maxLength={12}
                                                    placeholder="랭킹에 남길 이름"
                                                />
                                                <button
                                                    className="primary full"
                                                    onClick={register}>
                                                    비회원 기록 등록
                                                </button>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <button
                                        className="primary full"
                                        onClick={() => {
                                            setResult(null);
                                            setScreen('difficulty');
                                        }}>
                                        다시 도전하기
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </section>
            )}

            {screen === 'guide' && (
                <section className="panel guide">
                    <p className="eyebrow">게임 방법</p>
                    <h2>천천히, 한 톨씩.</h2>
                    <div className="guide-grid">
                        <article>
                            <span>01</span>
                            <h3>난이도를 고르세요</h3>
                            <p>
                                난이도에 따라 그릇에 담기는 쌀알 수가
                                달라집니다.
                            </p>
                        </article>
                        <article>
                            <span>02</span>
                            <h3>쌀알을 나누세요</h3>
                            <p>
                                젓가락으로 쌀알을 집어 책상이나 그릇에 놓으세요.
                                휠로 회전할 수 있습니다.
                            </p>
                        </article>
                        <article>
                            <span>03</span>
                            <h3>정답을 입력하세요</h3>
                            <p>
                                네 자리 숫자를 자리별로 조절해 제출하면 시간이
                                기록됩니다.
                            </p>
                        </article>
                    </div>
                    <button
                        className="primary"
                        onClick={() => setScreen('difficulty')}>
                        도전 시작
                    </button>
                </section>
            )}

            {screen === 'rank' && (
                <section className="panel rank">
                    <p className="eyebrow">명예의 기록</p>
                    <h2>가장 빠른 관찰자들</h2>
                    <div className="tabs">
                        {Object.entries(MODES).map(([key, mode]) => (
                            <button
                                className={rankMode === key ? 'active' : ''}
                                onClick={() => setRankMode(key)}
                                key={key}>
                                {mode.label}
                            </button>
                        ))}
                    </div>
                    <div className="score-list">
                        {scores.length ? (
                            scores.map((score, index) => (
                                <div key={score.id || `${score.name}-${index}`}>
                                    <b>{String(index + 1).padStart(2, '0')}</b>
                                    <span>{score.name}</span>
                                    <strong>{formatTime(score.seconds)}</strong>
                                </div>
                            ))
                        ) : (
                            <p className="empty">
                                아직 기록이 없습니다. 첫 번째 관찰자가
                                되어보세요.
                            </p>
                        )}
                    </div>
                    <small className="storage-note">
                        {firebaseEnabled
                            ? 'Firebase 전 세계 랭킹'
                            : 'Firebase 미설정 · 이 브라우저에 기록 저장 중'}
                    </small>
                </section>
            )}
            <footer>© 2026 RICE COUNT · A QUIET COUNTING GAME</footer>
        </main>
    );
}
