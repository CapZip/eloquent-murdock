import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import "./styles.css";

const LANES = 7;
const COL_WIDTH = 140;
const TILE_SIZE = 100;
const VISIBLE_COLS = 9;
const CENTER_LANE = Math.floor(LANES / 2);

const CHICKEN = process.env.PUBLIC_URL + "/game/Chicken Walk V2/Chicken Walk V2 000.png";
const CAR = process.env.PUBLIC_URL + "/game/Car Yellow V2 000.png";
const COIN = process.env.PUBLIC_URL + "/game/coins/multiplierCoin.png";
const TREE = process.env.PUBLIC_URL + "/game/Trees/Tree.png";
const TREE2 = process.env.PUBLIC_URL + "/game/Trees/Tree2.png";
const BUSH = process.env.PUBLIC_URL + "/game/Bush.png";
const SIDEWALK = process.env.PUBLIC_URL + "/game/Sidewalk/Union.png";
const BRICK = process.env.PUBLIC_URL + "/game/Brick.png";
const GRASS_VARIANTS = [
  process.env.PUBLIC_URL + "/game/Grass/01.png",
  process.env.PUBLIC_URL + "/game/Grass/02.png",
  process.env.PUBLIC_URL + "/game/Grass/03.png",
  process.env.PUBLIC_URL + "/game/Grass/04.png",
  process.env.PUBLIC_URL + "/game/Grass/05.png"
];

const COLORS = {
  grass: "#429d4b",
  road: "rgb(26,26,26)",
  pavement: "rgb(56,56,75)"
};

// Hardcoded column type sequence
const COLUMN_TYPES = [
  "grass", "grass", "grass", "grass", // 0-3 (before start)
  "pavement", // 4 (start)
  "road", "road", "road", // 5-7
  "grass", // 8
  "road", "road", // 9-10
  "grass", // 11
  "road", "road", "road", // 12-14
  "grass", // 15
  "pavement", // 16 (finish)
  "grass", "grass", "grass", "grass" // 17-20 (after finish)
];
const FINAL_COL = 16; // The actual finish column (pavement)

// Generate hash-based difficulty (10-25)
function generateHash() {
  return Math.floor(Math.random() * 16) + 10; // 10 to 25
}

// Preload all chicken frames for faster loading
const CHICKEN_FRAMES = Array.from({ length: 26 }, (_, i) =>
  process.env.PUBLIC_URL + `/game/Chicken Walk V2/Chicken Walk V2 ${String(i).padStart(3, '0')}.png`
);

const CHICKEN_DEAD_FRAMES = Array.from({ length: 32 }, (_, i) =>
  process.env.PUBLIC_URL + `/game/Chicken Dead V2/Chicken Dead V2 ${String(i).padStart(3, '0')}.png`
);

const EAGLE_FRAMES = Array.from({ length: 30 }, (_, i) =>
  process.env.PUBLIC_URL + `/game/Eagle Peck V2/Eagle Peck V2 ${String(i).padStart(3, '0')}.png`
);

// Preload all images on component mount
const preloadImages = (onComplete) => {
  const allImages = [
    ...CHICKEN_FRAMES,
    ...CHICKEN_DEAD_FRAMES,
    ...EAGLE_FRAMES,
    CAR,
    COIN,
    TREE,
    TREE2,
    BUSH,
    SIDEWALK,
    BRICK,
    ...GRASS_VARIANTS
  ];
  
  let loadedCount = 0;
  const totalImages = allImages.length;
  
  allImages.forEach(src => {
    const img = new Image();
    img.onload = () => {
      loadedCount++;
      if (loadedCount === totalImages) {
        onComplete();
      }
    };
    img.onerror = () => {
      loadedCount++;
      if (loadedCount === totalImages) {
        onComplete();
      }
    };
    img.src = src;
  });
};

function makeBoard() {
  // Returns a 2D array: board[lane][col] = { type, deco, hasCar, hasCoin, grassDecal, grassDecalStyle }
  const board = [];
  for (let l = 0; l < LANES; l++) {
    const row = [];
    for (let c = 0; c < COLUMN_TYPES.length; c++) { // Generate all columns for visuals
      const type = COLUMN_TYPES[c];
      let deco = null;
      let grassDecal = null;
      let grassDecalStyle = null;
      if (type === "grass") {
        if (l !== CENTER_LANE) {
          if (Math.random() < 0.7) deco = { type: "bush", img: BUSH, top: Math.random() * 40 + 30, left: Math.random() * 30 + 10 };
          else if (Math.random() < 1.0) deco = { type: "tree", img: Math.random() < 0.5 ? TREE : TREE2, top: Math.random() * 40 + 10, left: Math.random() * 30 + 5 };
        }
        grassDecal = GRASS_VARIANTS[Math.floor(Math.random() * GRASS_VARIANTS.length)];
        const size = 24 + Math.floor(Math.random() * 8); // 24-32px
        grassDecalStyle = {
          position: "absolute",
          left: `${30 + Math.random() * 40}%`,
          top: `${30 + Math.random() * 40}%`,
          width: size,
          height: size,
          transform: "translate(-50%, -50%)", // NO rotation
          opacity: 0.85,
          zIndex: 0
        };
      }
      const hasCoin = l === CENTER_LANE && (type === "road" || type === "grass") && c >= 4 && c < FINAL_COL;
      row.push({ type, deco, hasCoin, hasCar: false, grassDecal, grassDecalStyle });
    }
    board.push(row);
  }
  return board;
}

function makeCars(board) {
  // No cars at game start - they only appear when you die
  return [];
}

export default function App() {
  const [board, setBoard] = useState(makeBoard());
  const [player, setPlayer] = useState({ lane: CENTER_LANE, col: 4 }); // start on pavement
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [hash, setHash] = useState(generateHash());
  const [animCol, setAnimCol] = useState(4);
  const animating = useRef(false);
  const [carPositions, setCarPositions] = useState(() => makeCars(board)); // { lane, col, y }
  const [eaglePositions, setEaglePositions] = useState([]); // { lane, col, x }
  const chickenAnimRef = useRef({ col: 4, frame: 0 });
  const [forceRerender, setForceRerender] = useState(0);
  const [isDying, setIsDying] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [roadBlocks, setRoadBlocks] = useState([]); // Array of {col, lane} positions
  // Prevent holding spacebar
  const spaceHeld = useRef(false);
  
  // Preload all images on mount
  useEffect(() => {
    preloadImages(() => {
      setImagesLoaded(true);
    });
  }, []);

  // Simple animation loop for smooth frame updates
  useEffect(() => {
    const interval = setInterval(() => {
      setForceRerender(f => f + 1);
    }, 16); // 60fps
    
    return () => clearInterval(interval);
  }, []);

  // Calculate first visible column for centering
  const firstVisibleCol = Math.max(0, player.col - Math.floor(VISIBLE_COLS / 2));

  // Animate cars moving top to bottom
  useEffect(() => {
    if (gameOver || win) return;
    const interval = setInterval(() => {
      setCarPositions((oldCars) => {
        const newCars = oldCars.map((car) => {
          const newY = car.y + 0.35;
          // Check if car is hitting the chicken (CENTER_LANE is 3)
          if (Math.abs(newY - CENTER_LANE) < 0.5 && !isDying && !gameOver) {
            // Car is hitting chicken - trigger death animation
            setIsDying(true);
            animating.current = true;
            
            // Start death animation with requestAnimationFrame
            let deathStartTime = null;
            let deathAnimationId = null;
            
            const animateDeath = (timestamp) => {
              if (!deathStartTime) deathStartTime = timestamp;
              const elapsed = timestamp - deathStartTime;
              const frameTime = 60; // 60ms per frame for smoother death
              
              const currentFrame = Math.floor(elapsed / frameTime);
              chickenAnimRef.current.frame = Math.min(currentFrame, 31); // Cap at frame 31
              
              if (elapsed < 1920) { // 32 frames * 60ms = 1920ms
                deathAnimationId = requestAnimationFrame(animateDeath);
              } else {
                chickenAnimRef.current.frame = 31; // Stay on last death frame
                setGameOver(true);
                animating.current = false; // Reset animating flag
              }
            };
            deathAnimationId = requestAnimationFrame(animateDeath);
          }
          return { ...car, y: newY };
        });
        return newCars.filter((car) => car.y < LANES + 1);
      });
    }, 30);
    return () => clearInterval(interval);
  }, [gameOver, win, isDying]);

  // Animate eagles moving left to right across entire board
useEffect(() => {
  if (gameOver || win) return;
  const interval = setInterval(() => {
    setEaglePositions((oldEagles) => {
      const newEagles = oldEagles.map((eagle) => {
        const newX = eagle.x + 0.28; // Move right, slower
        // Check if eagle is hitting the chicken (player's column)
        if (Math.abs(newX - player.col) < 0.5 && !isDying && !gameOver) {
          // Eagle is hitting chicken - trigger death animation
          setIsDying(true);
          animating.current = true;
          
          // Start death animation with requestAnimationFrame
          let deathStartTime = null;
          let deathAnimationId = null;
          
          const animateDeath = (timestamp) => {
            if (!deathStartTime) deathStartTime = timestamp;
            const elapsed = timestamp - deathStartTime;
            const frameTime = 60; // 60ms per frame for smoother death
            
            const currentFrame = Math.floor(elapsed / frameTime);
            chickenAnimRef.current.frame = Math.min(currentFrame, 31); // Cap at frame 31
            
            if (elapsed < 1920) { // 32 frames * 60ms = 1920ms
              deathAnimationId = requestAnimationFrame(animateDeath);
            } else {
              chickenAnimRef.current.frame = 31; // Stay on last death frame
              setGameOver(true);
              animating.current = false; // Reset animating flag
            }
          };
          deathAnimationId = requestAnimationFrame(animateDeath);
        }
        return { ...eagle, x: newX };
      });
      return newEagles.filter((eagle) => eagle.x < FINAL_COL + 3); // Fly past the end pavement
    });
  }, 30);
  return () => clearInterval(interval);
}, [gameOver, win, isDying, player.col]);

  // Handle keyboard and touch controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" && !spaceHeld.current && !animating.current && !gameOver && !win && !cashedOut && !isDying) {
        spaceHeld.current = true;
        moveChicken();
      }
      if (e.code === "KeyC" && !gameOver && !win && !cashedOut && player.col > 4) {
        // Cashout
        setCashedOut(true);
        setScore(prev => prev * (1 + (player.col - 4) * 0.5)); // Bonus based on progress
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === "Space") {
        spaceHeld.current = false;
      }
    };
    
    // Touch controls
    const handleTouchStart = (e) => {
      e.preventDefault();
      if (!animating.current && !gameOver && !win && !cashedOut && !isDying) {
        moveChicken();
      }
    };
    
    const handleTouchMove = (e) => {
      e.preventDefault(); // Prevent scrolling
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [player, animating, gameOver, win, cashedOut]);

  // Animate chicken movement
  const moveChicken = () => {
    if (animating.current) return;
    if (player.col >= FINAL_COL) return;
    animating.current = true;
    
    const endCol = Math.min(player.col + 1, FINAL_COL);
    
    // Update player position immediately
    setPlayer((prev) => {
      if (prev.col === FINAL_COL) return prev;
      return { ...prev, col: endCol };
    });
    
    // Start walking animation
    chickenAnimRef.current.col = endCol;
    let frameIndex = 0;
    const walkInterval = setInterval(() => {
      chickenAnimRef.current.frame = frameIndex % 26;
      frameIndex++;
    }, 50);
    
    // End animation after transition duration
    setTimeout(() => {
      clearInterval(walkInterval);
      chickenAnimRef.current.frame = 0; // Back to idle
      animating.current = false;
      
      // Hash-based danger check AFTER movement animation completes
      if (endCol >= 4 && endCol < FINAL_COL) {
        const dangerThreshold = hash / 100; // base danger
        const progressMultiplier = (endCol - 4) / (FINAL_COL - 4); // progress
        const finalDanger = dangerThreshold * (1 + progressMultiplier * 1.2); // steeper scaling
        
        console.log(`Hash: ${hash}, Col: ${endCol}, Danger: ${(finalDanger * 100).toFixed(2)}%`);
        
                if (Math.random() < finalDanger) {
          // Player is doomed - prevent any further movement
          animating.current = true; // Lock movement
          
          // Spawn appropriate death animation based on terrain
          if (board[CENTER_LANE][endCol].type === "road") {
            // Car for road deaths
            setCarPositions(prev => [...prev, { 
              lane: 0, // Topmost lane
              col: endCol,
              y: -1.1 // Start fully off-screen above the board
            }]);
          } else if (board[CENTER_LANE][endCol].type === "grass") {
            // Eagle for grass deaths - flies across entire board
            setEaglePositions(prev => [...prev, {
              lane: CENTER_LANE, // Player's lane
              col: 4, // Start from beginning pavement
              x: -2 // Start off-screen to the left
            }]);
          } else {
            // If not on road or grass, trigger death immediately
            setIsDying(true);
            
            // Start death animation with requestAnimationFrame
            let deathStartTime = null;
            let deathAnimationId = null;
            
            const animateDeath = (timestamp) => {
              if (!deathStartTime) deathStartTime = timestamp;
              const elapsed = timestamp - deathStartTime;
              const frameTime = 60; // 60ms per frame for smoother death
              
              const currentFrame = Math.floor(elapsed / frameTime);
              chickenAnimRef.current.frame = Math.min(currentFrame, 31); // Cap at frame 31
              
              if (elapsed < 1920) { // 32 frames * 60ms = 1920ms
                deathAnimationId = requestAnimationFrame(animateDeath);
              } else {
                chickenAnimRef.current.frame = 31; // Stay on last death frame
                setGameOver(true);
                animating.current = false; // Reset animating flag
              }
            };
            deathAnimationId = requestAnimationFrame(animateDeath);
          }
        } else {
          // Chicken survived! Place road block if on road
          if (board[CENTER_LANE][endCol].type === "road") {
            setRoadBlocks(prev => [...prev, { col: endCol, lane: CENTER_LANE }]);
          }
        }
      }
    }, 300);
  };

  // Keep chickenAnimRef in sync with player.col (only when not animating)
  useEffect(() => {
    if (!animating.current) {
      chickenAnimRef.current.col = player.col;
    }
  }, [player.col]);

  // Check collisions, coins, win
  useEffect(() => {
    // Coin collection
    if (board[player.lane][player.col].hasCoin) {
      setScore((s) => s + (1 + player.col * 0.33));
      setBoard((oldBoard) => {
        const newBoard = oldBoard.map((row) => row.slice());
        newBoard[player.lane][player.col] = {
          ...newBoard[player.lane][player.col],
          hasCoin: false
        };
        return newBoard;
      });
    }
    
    // Win (very rare with high hash)
    if (player.col === FINAL_COL) setWin(true);
  }, [player, carPositions, board]);

  // Calculate scroll offset so chicken is always in the center column
  const scrollOffset = -(player.col - Math.floor(VISIBLE_COLS / 2)) * COL_WIDTH;

  // Render
  if (!imagesLoaded) {
    return (
      <div className="App" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <h1>UNCROSSABLE</h1>
          <div style={{ fontSize: 24, margin: 20 }}>Loading assets...</div>
          <div style={{ fontSize: 16, opacity: 0.7 }}>Please wait while we load the game</div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>UNCROSSABLE</h1>
      <div style={{ fontSize: 32, margin: 8, color: "#fff", textShadow: "2px 2px 8px #000" }}>
        Score: {score.toFixed(2)} | Hash: {hash} | Progress: {player.col - 4}/{FINAL_COL - 4}
        {gameOver && !isDying && <span> | <b>Game Over!</b></span>} 
        {win && <span style={{ color: 'lime' }}> | <b>WIN!</b></span>}
        {cashedOut && <span style={{ color: 'gold' }}> | <b>CASHED OUT!</b></span>}
        {isDying && <span style={{ color: 'red' }}> | <b>💀 DYING...</b></span>}
      </div>
      <div style={{ fontSize: 16, margin: 4, color: "#ccc", textShadow: "1px 1px 4px #000" }}>
        Press SPACE to move forward | Press C to cashout | Tap screen to move
      </div>
      <div
        className="game-board"
        style={{
          position: "relative",
          width: VISIBLE_COLS * COL_WIDTH,
          height: 800,
          margin: "24px auto",
          background: COLORS.grass,
          border: "4px solid #444",
          overflow: "hidden",
          boxShadow: "0 8px 32px #000a",
          boxSizing: "border-box"
        }}
      >
        {/* Board grid */}
        <motion.div
          style={{
            position: "absolute",
            top: 0,
            left: scrollOffset,
            height: "100%",
            width: board[0].length * COL_WIDTH,
            display: "flex"
          }}
          animate={{ left: scrollOffset }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          {Array.from({ length: board[0].length }).map((_, c) => (
            <div
              key={`col-${c}`}
              style={{
                position: "absolute",
                left: c * COL_WIDTH,
                top: 0,
                width: COL_WIDTH,
                height: "100%",
                background: undefined,
                zIndex: 0
              }}
            >
              {/* Stack lane backgrounds vertically in this column */}
              {board.map((row, l) => (
                <div
                  key={`lane-${l}-${c}`}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: Math.floor(l * (800 / LANES)),
                    width: COL_WIDTH,
                    height: Math.ceil(800 / LANES),
                    background: row[c]?.type === "grass" ? COLORS.grass : (row[c]?.type === "pavement" ? COLORS.pavement : (row[c]?.type ? COLORS[row[c].type] : COLORS.grass)),
                    overflow: "visible",
                    borderBottom: l < LANES - 1 ? "1px solid rgba(0,0,0,0.1)" : "none" // Subtle border to prevent gaps
                  }}
                >
                  {/* Grass decal (small, random) */}
                  {row[c]?.type === "grass" && row[c]?.grassDecal && (
                    <img
                      src={row[c].grassDecal}
                      alt="grass"
                      style={row[c].grassDecalStyle}
                    />
                  )}
                  {/* Sidewalk pattern */}
                  {row[c]?.type === "pavement" && (
                    <img
                      src={SIDEWALK}
                      alt="sidewalk"
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: "99%",
                        height: "99%",
                        transform: "translate(-50%, -50%)",
                        objectFit: "contain",
                        zIndex: 1
                      }}
                    />
                  )}
                  {/* Road lines */}
                  {row[c]?.type === "road" && (
                    <>
                      {/* Side white dashed lines */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          width: 6,
                          height: "100%",
                          background:
                            "repeating-linear-gradient(0deg, white 0px, white 20px, transparent 20px, transparent 40px)",
                          zIndex: 1
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 0,
                          width: 6,
                          height: "100%",
                          background:
                            "repeating-linear-gradient(0deg, white 0px, white 20px, transparent 20px, transparent 40px)",
                          zIndex: 1
                        }}
                      />
                      {/* Center yellow dashed line */}
                      <div
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: 0,
                          width: 3,
                          height: "100%",
                          opacity: 0.3,
                          background:
                            "repeating-linear-gradient(0deg, yellow 0px, yellow 30px, transparent 30px, transparent 60px)",
                          transform: "translateX(-50%)",
                          zIndex: 1
                        }}
                      />
                    </>
                  )}

                  {/* Decorations */}
                  {row[c]?.deco && (
                    <img
                      src={row[c].deco.img}
                      alt={row[c].deco.type}
                      style={{
                        position: "absolute",
                        left: row[c].deco.left,
                        top: row[c].deco.top,
                        width: row[c].deco.type === "tree" ? 120 : 95,
                        height: row[c].deco.type === "tree" ? 150 : 84,
                        zIndex: 2,
                        imageRendering: "pixelated"
                      }}
                    />
                  )}
                  {/* Coin only in chicken's lane, on roads, between crosswalks */}
                  {l === CENTER_LANE && board[CENTER_LANE][c].hasCoin && (
                    <motion.div
                      animate={{
                        y: [0, -18, 0],
                        transition: { duration: 1.2, repeat: Infinity, repeatType: "loop", ease: "easeInOut" }
                      }}
                      style={{
                        position: "absolute",
                        left: "28%",
                        top: "34%",
                        transform: "translate(-50%, -50%)",
                        width: 56,
                        height: 56,
                        zIndex: 3,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <img
                        src={COIN}
                        alt="coin"
                        style={{ width: 56, height: 56, imageRendering: "pixelated", position: "absolute", inset: 0 }}
                      />
                      <span style={{
                        position: "relative",
                        zIndex: 10,
                        color: "#fff",
                        fontWeight: "bold",
                        fontSize: 20,
                        textShadow: "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000"
                      }}>+{(0.33 * c).toFixed(2)}x</span>
                    </motion.div>
                  )}
                  {/* Car in this lane/column (top to bottom) */}
                  {carPositions.filter((car) => car.lane === l && car.col === c).map((car, i) => (
                    <motion.img
                      key={`car-${l}-${c}-${i}`}
                      src={CAR}
                      alt="car"
                      initial={{ scale: 1, opacity: 0, y: 0 }}
                      animate={{
                        y: car.y * (800 / LANES),
                        scale: 1,
                        opacity: 1,
                        transition: { duration: 0.3, ease: "easeOut" }
                      }}
                      exit={{ scale: 1, opacity: 0 }}
                                              style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          width: COL_WIDTH, // Full lane width
                          height: (800 / LANES), // Full lane height
                          zIndex: 50, // Much much higher than chicken (zIndex: 10)
                          imageRendering: "pixelated"
                        }}
                    />
                  ))}
                  

                  
                  {/* Road block */}
                  {roadBlocks.some(block => block.col === c && block.lane === l) && (
                    <motion.img
                      src={BRICK}
                      alt="road block"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      style={{
                        position: "absolute",
                        left: "7%",
                        bottom: "90%",
                        width: 120,
                        height: 60,
                        zIndex: 5,
                        imageRendering: "pixelated"
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </motion.div>
        {/* Chicken absolutely positioned inside board container */}
        <img
          src={isDying ? CHICKEN_DEAD_FRAMES[chickenAnimRef.current.frame] : CHICKEN_FRAMES[chickenAnimRef.current.frame]}
          alt="chicken"
          style={{
            position: "absolute",
            left: (chickenAnimRef.current.col - firstVisibleCol) * COL_WIDTH + COL_WIDTH * 0.5,
            top: CENTER_LANE * (800 / LANES) + (800 / LANES) / 2,
            transform: "translate(-50%, -50%)",
            width: 100,
            height: 100,
            zIndex: 10,
            imageRendering: "pixelated",
            pointerEvents: "none",
            filter: (isDying || gameOver) ? "grayscale(1)" : "none",
            transition: "left 0.3s ease-out"
          }}
          className="chicken-sprite"
        />
        {/* Cars absolutely positioned inside board container */}
        {carPositions.map((car, i) => (
          <motion.img
            key={`car-${i}`}
            src={CAR}
            alt="car"
            initial={{ scale: 1, opacity: 0, y: 0 }}
            animate={{
              y: car.y * (800 / LANES),
              scale: 1,
              opacity: 1,
              transition: { duration: 0.3, ease: "easeOut" }
            }}
            exit={{ scale: 1, opacity: 0 }}
            style={{
              position: "absolute",
              left: (car.col - firstVisibleCol) * COL_WIDTH,
              top: car.lane * (800 / LANES),
              width: COL_WIDTH,
              height: (800 / LANES),
              zIndex: 50,
              imageRendering: "pixelated",
              pointerEvents: "none"
            }}
          />
        ))}
        {/* Eagles absolutely positioned inside board container */}
        {eaglePositions.map((eagle, i) => (
          <motion.img
            key={`eagle-${i}`}
            src={EAGLE_FRAMES[Math.floor((forceRerender / 2) % 30)]}
            alt="eagle"
            initial={{ scale: 1, opacity: 0, x: 0 }}
            animate={{
              x: (eagle.x - firstVisibleCol) * COL_WIDTH,
              scale: 1,
              opacity: 1,
              transition: { duration: 0.3, ease: "easeOut" }
            }}
            exit={{ scale: 1, opacity: 0 }}
            style={{
              position: "absolute",
              left: 0,
              top: eagle.lane * (800 / LANES) + (800 / LANES) / 2 - 60,
              transform: "translateY(-50%)",
              width: 150,
              height: 100,
              zIndex: 25,
              imageRendering: "pixelated",
              pointerEvents: "none"
            }}
          />
        ))}
      </div>
      {gameOver && !isDying && <div style={{ fontSize: 32, color: "red" }}>Game Over</div>}
      {win && <div style={{ fontSize: 32, color: "lime" }}>You Win!</div>}
      
      {/* Mobile Touch Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '20px', 
        marginTop: '20px',
        padding: '10px'
      }}>
        <button
          onClick={() => {
            if (!animating.current && !gameOver && !win && !cashedOut && !isDying) {
              moveChicken();
            }
          }}
          disabled={animating.current || gameOver || win || cashedOut || isDying}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            minWidth: '120px'
          }}
        >
          MOVE
        </button>
        
        <button
          onClick={() => {
            if (!gameOver && !win && !cashedOut && player.col > 4 && !isDying) {
              setCashedOut(true);
              setScore(prev => prev * (1 + (player.col - 4) * 0.5));
            }
          }}
          disabled={gameOver || win || cashedOut || player.col <= 4 || isDying}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            minWidth: '120px'
          }}
        >
          CASHOUT
        </button>
      </div>
      
      <div style={{ marginTop: 16 }}>
        <b>Press Space to move right. Collect multipliers, avoid cars.</b>
      </div>
    </div>
  );
}
