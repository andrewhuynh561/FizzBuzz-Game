﻿import { useEffect, useState, useRef } from 'react';
import '../CSS/PlayGamePage.css'; // Adjust path as needed
import timerSound from '../assets/sounds/timer.mp3';
import correctSound from '../assets/sounds/correct.mp3';
import incorrectSound from '../assets/sounds/incorrect.mp3';

interface GameRule {
    id?: number;
    divisor: number;
    replacementText: string;
}

interface Game {
    id: number;
    name: string;
    author: string;
    rules: GameRule[];
}

interface StartSessionResponse {
    sessionId: number;
    endTime: string;
}

function PlayGamePage() {
    // 1) Games & selection
    const [games, setGames] = useState<Game[]>([]);
    const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
    const [durationSeconds, setDurationSeconds] = useState<number>(60);

    // 2) Session & Timer
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<Date | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);

    // 3) Audio references
    const beepAudio = useRef<HTMLAudioElement | null>(null);
    const correctAudio = useRef<HTMLAudioElement | null>(null);
    const incorrectAudio = useRef<HTMLAudioElement | null>(null);

    // 4) Gameplay
    const [currentNumber, setCurrentNumber] = useState<number | null>(null);
    const [userAnswer, setUserAnswer] = useState("");
    const [correctCount, setCorrectCount] = useState(0);
    const [incorrectCount, setIncorrectCount] = useState(0);

    // Timer reference (for clearing interval on unmount)
    const timerRef = useRef<NodeJS.Timer | null>(null);

    
    useEffect(() => {
        beepAudio.current = new Audio(timerSound);
        correctAudio.current = new Audio(correctSound);
        incorrectAudio.current = new Audio(incorrectSound);

        // Optional: set volume levels, e.g. beepAudio.current.volume = 0.5;
    }, []);

   
    useEffect(() => {
        fetch("https://localhost:7178/api/Games")
            .then(async (res) => {
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`Error fetching games: ${text}`);
                }
                return res.json();
            })
            .then((data: Game[]) => {
                setGames(data);
                if (data.length > 0) {
                    setSelectedGameId(data[0].id);
                }
            })
            .catch((err) => {
                console.error(err);
                alert("Failed to load games. Check console for details.");
            });
    }, []);

    
    const handleStartSession = async () => {
        if (!selectedGameId) {
            alert("Please select a game first.");
            return;
        }
        try {
            const response = await fetch("https://localhost:7178/api/Sessions/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gameId: selectedGameId,
                    durationSeconds: durationSeconds,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Start session error: ${text}`);
            }

            const data: StartSessionResponse = await response.json();
            setSessionId(data.sessionId);

            // Convert endTime string to Date
            const end = new Date(data.endTime);
            setEndTime(end);

            // Reset scoreboard
            setCorrectCount(0);
            setIncorrectCount(0);

            // Clear any existing timer
            if (timerRef.current) clearInterval(timerRef.current);

            // Start interval for countdown
            timerRef.current = setInterval(() => {
                updateTimeLeft(end);
            }, 1000);

            // Immediately update timeLeft
            updateTimeLeft(end);

            // Fetch the first random number
            fetchNextNumber(data.sessionId);
        } catch (error) {
            console.error(error);
            alert(String(error));
        }
    };

    const updateTimeLeft = (end: Date) => {
        const now = new Date();
        const diffMs = end.getTime() - now.getTime();
        const diffSec = Math.max(0, Math.floor(diffMs / 1000));
        setTimeLeft(diffSec);

        // If time is up, clear the interval
        if (diffSec <= 0 && timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

   
   
    useEffect(() => {
        const isGameActive = sessionId !== null && timeLeft > 0;
        if (isGameActive) {
            // Play the beep sound each time timeLeft updates (except maybe timeLeft=0)
            beepAudio.current?.play().catch((err) => {
                // Some browsers block autoplay if no user interaction
                console.warn("Beep audio failed to play:", err);
            });
        }
    }, [timeLeft, sessionId]);

    const fetchNextNumber = async (sessionIdValue: number) => {
        try {
            const response = await fetch(
                `https://localhost:7178/api/Sessions/${sessionIdValue}/next-number`
            );
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Fetch next number error: ${text}`);
            }
            const data = await response.json();
            setCurrentNumber(data.number);
            setUserAnswer("");
        } catch (error) {
            console.error(error);
            alert(String(error));
        }
    };

 
    const handleSubmitAnswer = async () => {
        if (!sessionId || currentNumber === null) return;

        try {
            const response = await fetch(
                `https://localhost:7178/api/Sessions/${sessionId}/answer`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        number: currentNumber,
                        userAnswer: userAnswer,
                    }),
                }
            );

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Submit answer error: ${text}`);
            }

            const data = await response.json();
            if (data.correct) {
                setCorrectCount((prev) => prev + 1);
                // Play correct sound
                correctAudio.current?.play();
            } else {
                setIncorrectCount((prev) => prev + 1);
                // Play incorrect sound
                incorrectAudio.current?.play();
            }

            fetchNextNumber(sessionId);
        } catch (error) {
            console.error(error);
            alert(String(error));
        }
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    const isGameActive = sessionId !== null && timeLeft > 0;

   
    const currentGame = games.find((g) => g.id === selectedGameId);

    return (
        <div className="play-game-page">
            <h1 className="title">Play a FizzBuzz Game</h1>

            {!sessionId && (
                <div className="setup-section">
                    <div>
                        <label>Choose Game:</label>
                        <select
                            value={selectedGameId ?? ""}
                            onChange={(e) => setSelectedGameId(Number(e.target.value))}
                        >
                            {games.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.name} by {g.author}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label>Duration (seconds):</label>
                        <input
                            type="number"
                            value={durationSeconds}
                            onChange={(e) => setDurationSeconds(Number(e.target.value))}
                        />
                    </div>
                    <button onClick={handleStartSession}>Start Game</button>
                </div>
            )}

           
            {currentGame && (
                <div className="rules-box">
                    <h2>Game Rules for {currentGame.name}</h2>
                    <ul>
                        {currentGame.rules.map((rule, idx) => (
                            <li key={idx}>
                                If divisible by {rule.divisor}, say "{rule.replacementText}"
                            </li>
                        ))}
                        <li>
                            If a number is divisible by multiple divisors, concatenate the
                            words!
                        </li>
                    </ul>
                </div>
            )}

          
            {sessionId && (
                <div className="gameplay-section">
                    <div className="timer-display">
                        {timeLeft > 0 ? (
                            <span>{timeLeft} seconds left</span>
                        ) : (
                            <span>Time's up!</span>
                        )}
                    </div>

                    <div className="number-box">
                        {currentNumber !== null ? currentNumber : "--"}
                    </div>

                    <div className="answer-area">
                        <input
                            type="text"
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            placeholder="Your answer..."
                            disabled={!isGameActive}
                        />
                        <button onClick={handleSubmitAnswer} disabled={!isGameActive}>
                            Submit
                        </button>
                    </div>

                    <div className="scoreboard">
                        <div className="score correct">Correct: {correctCount}</div>
                        <div className="score incorrect">Incorrect: {incorrectCount}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PlayGamePage;
