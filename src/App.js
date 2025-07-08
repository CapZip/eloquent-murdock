import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import "./styles.css";
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import '@solana/wallet-adapter-react-ui/styles.css';
import { clusterApiUrl } from '@solana/web3.js';

const LANES = 7;
const COL_WIDTH = 140;
const TILE_SIZE = 100;
const VISIBLE_COLS = 9;
const CENTER_LANE = Math.floor(LANES / 2);
const PAVEMENT_START_COL = 4;

const CHICKEN = process.env.PUBLIC_URL + "/game/Chicken Walk V2/Chicken Walk V2 003.png";
const CAR_YELLOW = process.env.PUBLIC_URL + "/game/Car Yellow V2 000.png";
const CAR_RED = process.env.PUBLIC_URL + "/game/Car Red V2 000.png";
const CAR_GREEN = process.env.PUBLIC_URL + "/game/Car Green V2 000.png";
const CAR_BLUE = process.env.PUBLIC_URL + "/game/Car Blue V2 000.png";
const CARS = [CAR_YELLOW, CAR_RED, CAR_GREEN, CAR_BLUE];
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
const COIN_FRAME = process.env.PUBLIC_URL + "/game/Coin Frame.png";

const COLORS = {
  grass: "#429d4b",
  road: "#17171d",
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
  "pavement", // 15 (finish)
  "grass", "grass", "grass", "grass" // 16-19 (after finish)
];
const FINAL_COL = 15; // The actual finish column (pavement)

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
    ...CARS,
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
    for (let c = 0; c < COLUMN_TYPES.length; c++) {
      const type = COLUMN_TYPES[c];
      let deco = null;
      let grassDecal = null;
      let grassDecalStyle = null;
      if (type === "grass") {
        if (l !== CENTER_LANE) {
          if (Math.random() < 0.3) deco = { type: "bush", img: BUSH, top: Math.random() * 40 + 30, left: Math.random() * 30 + 10 };
          else if (Math.random() < 0.15) deco = { type: "tree", img: Math.random() < 0.5 ? TREE : TREE2, top: Math.random() * 40 + 10, left: Math.random() * 30 + 5 };
        } else {
          deco = null; // No trees or bushes in center lane
        }
        // Only spawn a grass decal in ~85% of grass tiles
        if (Math.random() < 0.85) {
          grassDecal = GRASS_VARIANTS[Math.floor(Math.random() * GRASS_VARIANTS.length)];
          const size = 16 + Math.floor(Math.random() * 9); // 16-24px
          const left = `${10 + Math.random() * 80}%`;
          const top = `${10 + Math.random() * 80}%`;
          const rotate = `rotate(${Math.floor(Math.random() * 21) - 10}deg)`; // -10 to 10 deg
          const opacity = 0.7 + Math.random() * 0.3; // 0.7-1.0
          grassDecalStyle = {
            position: "absolute",
            left,
            top,
            width: size,
            height: size,
            transform: `translate(-50%, -50%) ${rotate}`,
            opacity,
            zIndex: 0
          };
        }
      }
      // No grass decals on pavement or road
      if (type === "pavement" || type === "road") {
        grassDecal = null;
        grassDecalStyle = null;
      }
      // Place coins on roads, grass, and the final pavement (finish)
      const hasCoin = l === CENTER_LANE && (
        ((type === "road" || type === "grass") && c >= 4 && c < FINAL_COL) ||
        (type === "pavement" && c === FINAL_COL)
      );
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

// Responsive visible columns
function getVisibleCols() {
  return window.innerWidth <= 768 ? 3 : 9;
}

// Add selector frame constants
const SELECTOR_FRAMES = [
  process.env.PUBLIC_URL + "/game/Selector.png",
  process.env.PUBLIC_URL + "/game/Slector 01.png"
];

const CAR_SPEEDS = {
  easy: 0.03,
  medium: 0.04,
  hard: 0.06,
  daredevil: 0.10
};

const EAGLE_SPEED = window.innerWidth <= 768 ? 0.05 * 1.3 : 0.05; // 30% faster on mobile

export default function App() {
  const [difficulty, setDifficulty] = useState('medium');
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
  const chickenAnimRef = useRef({ col: 4, frame: 3 });
  const [forceRerender, setForceRerender] = useState(0);
  const [isDying, setIsDying] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [roadBlocks, setRoadBlocks] = useState([]); // Array of {col, lane} positions
  const [claimedCoins, setClaimedCoins] = useState([]); // Array of claimed coin columns
  const [backgroundCars, setBackgroundCars] = useState([]); // Array of {lane, col, y, speed, carType}
  const [visibleCols, setVisibleCols] = useState(getVisibleCols());
  const [selectorFrame, setSelectorFrame] = useState(0);
  const [selectedToken, setSelectedToken] = useState("SOLANA");
  
  // Drag state variables
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [manualScrollOffset, setManualScrollOffset] = useState(0);
  const [manualCameraYOffset, setManualCameraYOffset] = useState(0);
  const [initialScrollOffset, setInitialScrollOffset] = useState(0);
  const [hasManualPosition, setHasManualPosition] = useState(false);
  const dragRef = useRef(null);
  const lastDragTime = useRef(0);
  
  // Prevent holding spacebar
  const spaceHeld = useRef(false);
  
  const tokenOptions = [
    { label: "BONK", value: "BONK", icon: "🐕" },
    { label: "WIF", value: "WIF", icon: "🧢" },
    { label: "POPCAT", value: "POPCAT", icon: "🐱" },
    { label: "SOLANA", value: "SOLANA", icon: <img src="https://i.imgur.com/lW6NcuO.png" alt="Solana" style={{ width: 18, height: 18, verticalAlign: 'middle' }} /> }
  ];
  
  const endpoint = clusterApiUrl('mainnet-beta');
  const wallets = [new PhantomWalletAdapter()];
  
  // Preload all images on mount
  useEffect(() => {
    preloadImages(() => {
      setImagesLoaded(true);
    });
  }, []);

  // Simple animation loop for smooth frame updates
  useEffect(() => {
    let animationId;
    const animate = () => {
      setForceRerender(f => f + 1);
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationId);
  }, []);

  // Calculate first visible column for centering
  let firstVisibleCol;
  const halfVisible = Math.floor(visibleCols / 2);
  
  // Use manual drag offset if dragging, otherwise use automatic camera
  let finalScrollOffset;
  let finalCameraYOffset;
  
  if (isDragging || hasManualPosition) {
    // Use manual drag offsets directly without any interference
    finalScrollOffset = manualScrollOffset;
    finalCameraYOffset = manualCameraYOffset;
    // Calculate firstVisibleCol from manual offset for positioning calculations
    firstVisibleCol = Math.round(-manualScrollOffset / COL_WIDTH);
  } else {
    // Use automatic camera logic
    if (window.innerWidth <= 768) {
      const progress = player.col - PAVEMENT_START_COL;
      if (player.col === PAVEMENT_START_COL) {
        firstVisibleCol = player.col; // Chicken on the left
      } else if (progress % 2 === 0) {
        firstVisibleCol = player.col - 1; // Chicken centered
      } else {
        firstVisibleCol = player.col; // Chicken on the left, camera jumps
      }
      if (firstVisibleCol > board[0].length - visibleCols) {
        firstVisibleCol = board[0].length - visibleCols; // Clamp to end
      }
    } else {
      firstVisibleCol = Math.max(0, player.col - halfVisible);
    }
    finalScrollOffset = -firstVisibleCol * COL_WIDTH;
    
    // Calculate vertical camera offset for mobile
    finalCameraYOffset = 0;
    if (window.innerWidth <= 768) {
      const boardHeight = 800;
      const laneHeight = boardHeight / LANES;
      const boardPixelHeight = boardHeight;
      const containerHeight = boardHeight; // .game-board height
      const chickenY = CENTER_LANE * laneHeight + laneHeight / 2;
      const centerY = containerHeight / 2;
      let desiredOffset = centerY - chickenY;
      // Clamp so we don't scroll past the top or bottom
      const maxOffset = 0;
      const minOffset = containerHeight - boardPixelHeight;
      finalCameraYOffset = Math.max(Math.min(desiredOffset, maxOffset), minOffset);
    }
  }

  // Animate cars moving top to bottom
  useEffect(() => {
    if (gameOver || win) return;
    let frame;
    function loop() {
      setCarPositions((oldCars) => {
        const newCars = oldCars.map((car) => {
          const newY = car.y + CAR_SPEEDS[difficulty];
          // Check if car is hitting the chicken (CENTER_LANE is 3)
          if (Math.abs(newY - CENTER_LANE) < 0.5 && !isDying && !gameOver) {
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
              if (elapsed < 1920) {
                deathAnimationId = requestAnimationFrame(animateDeath);
              } else {
                chickenAnimRef.current.frame = 31;
                setGameOver(true);
                setStreak(0);
                setCurrentWinnings(betAmount);
                setCurrentMultiplier(1.0);
                animating.current = false;
              }
            };
            deathAnimationId = requestAnimationFrame(animateDeath);
          }
          return { ...car, y: newY };
        });
        return newCars.filter((car) => car.y < LANES + 1);
      });
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [gameOver, win, isDying, difficulty]);

  // Animate eagles moving left to right across entire board
  useEffect(() => {
    if (gameOver || win) return;
    let frame;
    function loop() {
      setEaglePositions((oldEagles) => {
        const newEagles = oldEagles.map((eagle) => {
          const newX = eagle.x + EAGLE_SPEED;
          // Check if eagle is hitting the chicken (player's column)
          if (Math.abs(newX - player.col) < 0.5 && !isDying && !gameOver) {
            setIsDying(true);
            animating.current = true;
            // Start death animation with requestAnimationFrame
            let deathStartTime = null;
            let deathAnimationId = null;
            const animateDeath = (timestamp) => {
              if (!deathStartTime) deathStartTime = timestamp;
              const elapsed = timestamp - deathStartTime;
              const frameTime = 60;
              const currentFrame = Math.floor(elapsed / frameTime);
              chickenAnimRef.current.frame = Math.min(currentFrame, 31);
              if (elapsed < 1920) {
                deathAnimationId = requestAnimationFrame(animateDeath);
              } else {
                chickenAnimRef.current.frame = 31;
                setGameOver(true);
                setStreak(0);
                setCurrentWinnings(betAmount);
                setCurrentMultiplier(1.0);
                animating.current = false;
              }
            };
            deathAnimationId = requestAnimationFrame(animateDeath);
          }
          return { ...eagle, x: newX };
        });
        return newEagles.filter((eagle) => eagle.x < FINAL_COL + 6);
      });
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [gameOver, win, isDying, player.col, difficulty]);

  // Background car spawning and animation system
  useEffect(() => {
    if (gameOver || win) return;
    
    // Spawn new background cars randomly
    const spawnInterval = setInterval(() => {
      // Only spawn cars on road lanes ahead of the player (excluding center lane)
      const roadLanes = [0, 1, 2, 4, 5, 6]; // All lanes except center (3)
      const randomLane = roadLanes[Math.floor(Math.random() * roadLanes.length)];
      
      // Find a random road column ahead of the player's current position (but not the next column)
      const roadColumns = [];
      for (let col = player.col + 2; col < FINAL_COL; col++) {
        if (board[randomLane][col].type === "road") {
          roadColumns.push(col);
        }
      }
      
      // Bias spawn toward visible columns on mobile
      let spawnCol = null;
      if (roadColumns.length > 0 && Math.random() < 0.7) { // 70% chance to spawn
        let candidateCols = roadColumns;
        if (window.innerWidth <= 768) {
          // On mobile, bias toward visible columns
          const visibleStart = firstVisibleCol;
          const visibleEnd = firstVisibleCol + visibleCols - 1;
          const visibleColsArr = roadColumns.filter(col => col >= visibleStart && col <= visibleEnd);
          // 80% chance to pick from visible, 20% from all
          if (visibleColsArr.length && Math.random() < 0.8) {
            candidateCols = visibleColsArr;
          }
        }
        spawnCol = candidateCols[Math.floor(Math.random() * candidateCols.length)];
      }
      
      // Prevent overlapping: don't spawn if a car is already in this lane/col near the top
      if (spawnCol !== null) {
        // Check for minimum distance between cars in the same lane/col
        const minDistance = 2; // Minimum distance between cars
        const hasNearbyCar = backgroundCars.some(car => 
          car.lane === randomLane && 
          car.col === spawnCol && 
          car.y > -minDistance && 
          car.y < minDistance
        );
        
        if (!hasNearbyCar) {
          setBackgroundCars(prev => [...prev, {
            lane: randomLane,
            col: spawnCol,
            y: -1.1, // Start above the board
            speed: CAR_SPEEDS[difficulty], // Same speed as death cars
            carType: Math.floor(Math.random() * CARS.length) // Random car color
          }]);
        }
      }
    }, 800 + Math.random() * 800); // Randomize spawn interval between 0.8-1.6 seconds
    
    // Animate background cars moving down
    let frame;
    function loop() {
      setBackgroundCars((oldCars) => {
        const newCars = oldCars.map((car) => ({
          ...car,
          y: car.y + CAR_SPEEDS[difficulty]
        }));
        return newCars.filter((car) => car.y < LANES + 1);
      });
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => {
      clearInterval(spawnInterval);
      cancelAnimationFrame(frame);
    };
  }, [gameOver, win, player.col, board, difficulty]);

  // Handle keyboard and touch controls
  useEffect(() => {
    const handleKeyDown = (e) => {
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
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [player, animating, gameOver, win, cashedOut]);

  // Drag event handlers for draggable game board
  const handlePointerDown = (e) => {
    // Don't start drag if clicking on a coin or UI element
    if (e.target.closest('.next-claimable-coin') || 
        e.target.closest('.game-header') || 
        e.target.closest('.game-footer-bar') ||
        e.target.closest('.mobile-menu-overlay')) {
      return;
    }
    
    e.preventDefault();
    const rect = dragRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    setIsDragging(true);
    setDragStart({ x, y: 0 });
    setDragOffset({ x: 0, y: 0 });
    
    // If not already in manual mode, use current camera position
    if (!hasManualPosition) {
      setManualScrollOffset(finalScrollOffset);
      setInitialScrollOffset(finalScrollOffset);
      setHasManualPosition(true); // Mark that user is now in manual mode
    } else {
      setInitialScrollOffset(manualScrollOffset);
    }
    
    lastDragTime.current = Date.now();
    
    // Set pointer capture for consistent behavior
    dragRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const rect = dragRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Calculate the difference from the start position
    const deltaX = x - dragStart.x;
    
    // Only start dragging after a minimum distance to prevent accidental drags
    const minDragDistance = 3;
    if (Math.abs(deltaX) < minDragDistance) {
      return;
    }
    
    // Apply drag sensitivity to make it slower
    const dragSensitivity = 0.6;
    const adjustedDeltaX = deltaX * dragSensitivity;
    
    // Calculate new scroll offset by adding the delta to the initial scroll offset
    const newScrollOffset = initialScrollOffset + adjustedDeltaX;
    const maxScrollOffset = 0; // Can't scroll past the start
    const minScrollOffset = -(board[0].length - visibleCols) * COL_WIDTH; // Can't scroll past the end
    
    const clampedScrollOffset = Math.max(minScrollOffset, Math.min(maxScrollOffset, newScrollOffset));
    
    // Only update if the value actually changed to prevent unnecessary re-renders
    if (Math.abs(clampedScrollOffset - manualScrollOffset) > 0.1) {
      setManualScrollOffset(clampedScrollOffset);
    }
    setDragOffset({ x: deltaX, y: 0 });
    lastDragTime.current = Date.now();
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setDragStart(null);
    setDragOffset({ x: 0, y: 0 });
    
    // Check if this was a significant drag (not just a click)
    const dragDistance = Math.abs(dragOffset.x);
    if (dragDistance > 5) {
      setHasManualPosition(true); // Mark that user has manually positioned the camera
    }
    
    // Release pointer capture
    if (dragRef.current) {
      dragRef.current.releasePointerCapture(e.pointerId);
    }
  };

  // Animate chicken movement
  const moveChicken = () => {
    if (animating.current) return;
    if (isDying) return;
    if (player.col >= FINAL_COL) return;
    animating.current = true;
    
    const endCol = Math.min(player.col + 1, FINAL_COL);
    
    // Update player position immediately
    setPlayer((prev) => {
      if (prev.col === FINAL_COL) return prev;
      return { ...prev, col: endCol };
    });
    
    // Update streak and multiplier
    const newStreak = streak + 1;
    setStreak(newStreak);
    
    // Calculate current multiplier based on difficulty and streak
    const multiplierIndex = Math.min(newStreak - 1, DIFFICULTY_MULTIPLIERS[difficulty].length - 1);
    const newMultiplier = DIFFICULTY_MULTIPLIERS[difficulty][multiplierIndex];
    setCurrentMultiplier(newMultiplier);
    
    // Update current winnings
    setCurrentWinnings(betAmount * newMultiplier);
    
    // Reset camera to center on chicken when moving
    setManualScrollOffset(0); // Reset to automatic camera mode
    setHasManualPosition(false); // Reset manual mode
    
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
      chickenAnimRef.current.frame = 3; // Back to idle
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
            setCarPositions(prev => [
              ...prev.filter(car => !(car.lane === 0 && car.col === endCol)),
              { lane: 0, col: endCol, y: -1.1, carType: Math.floor(Math.random() * CARS.length) }
            ]);
          } else if (board[CENTER_LANE][endCol].type === "grass") {
            // Eagle for grass deaths - flies across entire board
            const eagleStartCol = Math.max(0, endCol - 3);
            setEaglePositions(prev => [...prev, {
              lane: CENTER_LANE, // Player's lane
              col: eagleStartCol, // Start closer to the player
              x: eagleStartCol - 2 // Start off-screen to the left of eagleStartCol
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
                setStreak(0); // Reset streak on death
                setCurrentWinnings(betAmount); // Reset winnings on death
                setCurrentMultiplier(1.0); // Reset multiplier on death
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
      // Track claimed coin column (center lane only)
      setClaimedCoins((prev) => [...prev, player.col]);
    }
    
    // Win (very rare with high hash)
    if (player.col === FINAL_COL) setWin(true);
  }, [player, carPositions, board]);

  useEffect(() => {
    function handleResize() {
      setVisibleCols(getVisibleCols());
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Collect all tree/bush decorations for the board
  const allDecos = [];
  for (let l = 0; l < board.length; l++) {
    for (let c = 0; c < board[l].length; c++) {
      const deco = board[l][c].deco;
      if (deco) {
        allDecos.push({ ...deco, lane: l, col: c });
      }
    }
  }

  // Selector frame pulsing effect
  useEffect(() => {
    const interval = setInterval(() => {
      setSelectorFrame(f => (f + 1) % 2);
    }, 500); // Slower pulse
    return () => clearInterval(interval);
  }, []);

  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Difficulty settings and multipliers
  const DIFFICULTY_MULTIPLIERS = {
    easy: [1.00, 1.09, 1.20, 1.33, 1.50, 1.71, 2.00, 2.40, 3.00, 3.43, 5.00],
    medium: [1.09, 1.43, 1.94, 2.71, 3.94, 6.07, 10.04, 18.40, 26.29, 39.43, 63.09],
    hard: [1.20, 1.52, 1.94, 2.51, 4.39, 8.24, 11.68, 25.48, 39.63, 64.40, 110.40],
    daredevil: [1.60, 2.74, 4.85, 8.90, 16.98, 33.97, 71.71, 161.35, 391.86, 1044.96, 3134.87]
  };

  // Streak and winnings tracking
  const [streak, setStreak] = useState(0);
  const [currentWinnings, setCurrentWinnings] = useState(8);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [betAmount, setBetAmount] = useState(8);
  const [betFraction, setBetFraction] = useState("MAX");

  // Difficulty button handlers
  const handleDifficultyChange = (newDifficulty) => {
    setDifficulty(newDifficulty);
  };

  // Bet amount handlers
  const handleBetAmountChange = (e) => {
    const value = parseFloat(e.target.value) || 0;
    setBetAmount(Math.max(0, value));
    setBetFraction("CUSTOM");
  };
  
  const handleBetFractionClick = (fraction) => {
    setBetFraction(fraction);
    let newAmount = betAmount; // Use current bet amount as base
    
    switch (fraction) {
      case "1/4":
        newAmount = Math.floor(betAmount * 0.25);
        break;
      case "1/2":
        newAmount = Math.floor(betAmount * 0.5);
        break;
      case "3/4":
        newAmount = Math.floor(betAmount * 0.75);
        break;
      case "MAX":
        newAmount = betAmount; // Keep current amount for MAX
        break;
      default:
        newAmount = betAmount;
    }
    
    setBetAmount(Math.max(1, newAmount));
  };

  const coinTapGuard = useRef(false);

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
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="App">
            {/* Game Header */}
            <div className="game-header">
              {/* Single row: title left, right side varies by device */}
              <div className="game-header-row">
                <div className="game-header-title">UNCROSSABLE</div>
                {/* Desktop: right side menu */}
                <div className="game-header-desktop-menu">
                  <div className="game-header-coins">
                    <span>100</span>
                    {selectedToken === "SOLANA"
                      ? <img src="https://i.imgur.com/lW6NcuO.png" alt="Solana" style={{ width: 22, height: 22, marginLeft: 4, verticalAlign: 'middle' }} />
                      : <span style={{ marginLeft: 4 }}>{tokenOptions.find(opt => opt.value === selectedToken).icon}</span>
                    }
                  </div>
                  <select
                    className="game-header-selector"
                    value={selectedToken}
                    onChange={e => setSelectedToken(e.target.value)}
                  >
                    {tokenOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{typeof opt.icon === 'string' ? opt.icon + ' ' : ''}{opt.label}</option>
                    ))}
                  </select>
                  <div style={{ minWidth: 120 }}>
                    <WalletMultiButton />
                  </div>
                  <button className="game-header-leaderboard">
                    <img src="/game/UI/charticon.svg" alt="Leaderboard" style={{ width: 20, height: 20, filter: 'brightness(0) invert(1)' }} />
                  </button>
                </div>
                {/* Mobile: amount and menu button */}
                <div className="game-header-mobile-menu">
                  <div className="game-header-coins">
                    <span>100</span>
                    {selectedToken === "SOLANA"
                      ? <img src="https://i.imgur.com/lW6NcuO.png" alt="Solana" style={{ width: 22, height: 22, marginLeft: 4, verticalAlign: 'middle' }} />
                      : <span style={{ marginLeft: 4 }}>{tokenOptions.find(opt => opt.value === selectedToken).icon}</span>
                    }
                  </div>
                  <button className="mobile-menu-btn" onClick={() => setShowMobileMenu(v => !v)}>
                    <svg className="w-7 h-7" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                  </button>
                </div>
              </div>
            </div>
            {/* Mobile Menu Overlay */}
            {showMobileMenu && (
              <div className="mobile-menu-overlay sm:hidden" onClick={() => setShowMobileMenu(false)}>
                <div className="mobile-menu-content" onClick={e => e.stopPropagation()}>
                  <div className="text-white text-sm font-bold mb-2">Select Token:</div>
                  <button className={`flex items-center gap-2 px-3 py-2 rounded ${selectedToken === 'BONK' ? 'bg-gray-700' : 'hover:bg-gray-800'} transition-colors`} onClick={() => setSelectedToken('BONK')}><span className="text-orange-400 text-lg">🐕</span><span className="text-white">BONK</span></button>
                  <button className={`flex items-center gap-2 px-3 py-2 rounded ${selectedToken === 'WIF' ? 'bg-gray-700' : 'hover:bg-gray-800'} transition-colors`} onClick={() => setSelectedToken('WIF')}><span className="text-blue-400 text-lg">🧢</span><span className="text-white">WIF</span></button>
                  <button className={`flex items-center gap-2 px-3 py-2 rounded ${selectedToken === 'POPCAT' ? 'bg-gray-700' : 'hover:bg-gray-800'} transition-colors`} onClick={() => setSelectedToken('POPCAT')}><span className="text-purple-400 text-lg">🐱</span><span className="text-white">POPCAT</span></button>
                  <button className={`flex items-center gap-2 px-3 py-2 rounded ${selectedToken === 'SOLANA' ? 'bg-gray-700' : 'hover:bg-gray-800'} transition-colors`} onClick={() => setSelectedToken('SOLANA')}><span className="text-green-400 text-lg">◉</span><span className="text-white">SOL</span></button>
                  <div className="border-t border-gray-700 mt-2 pt-2"></div>
                  <div className="flex flex-col gap-2">
                    <WalletMultiButton className="mobile-wallet-btn" />
                    <button className="flex items-center gap-2 p-2 hover:bg-gray-800 rounded transition-colors" onClick={() => {/* leaderboard logic */}}><img src="/game/UI/charticon.svg" alt="Leaderboard" className="w-5 h-5 opacity-100" style={{filter: 'brightness(0) invert(1)'}} /><span className="text-white text-sm">Leaderboard</span></button>
                  </div>
                </div>
              </div>
            )}
            <div
              ref={dragRef}
              className="game-board"
              style={{
                position: "relative",
                width: visibleCols * COL_WIDTH,
                height: 725,
                margin: "24px auto",
                marginBottom: "0",
                marginTop: finalCameraYOffset,
                background: COLORS.grass,
                overflow: "hidden",
                boxShadow: "0 8px 32px #000a",
                boxSizing: "border-box",
                cursor: isDragging ? "grabbing" : "grab",
                userSelect: "none",
                touchAction: "none"
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              {/* Board grid */}
              <motion.div
                style={{
                  position: "absolute",
                  top: 0,
                  left: finalScrollOffset,
                  height: "100%",
                  width: board[0].length * COL_WIDTH,
                  display: "flex",
                  transform: `translateY(${finalCameraYOffset}px)`
                }}
                animate={isDragging ? {} : { left: finalScrollOffset }}
                transition={isDragging ? {} : { type: "spring", stiffness: 200, damping: 20 }}
              >
                {/* Board grid columns/tiles */}
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
                              zIndex: 10 + l, // higher for lower lanes
                              imageRendering: "pixelated",
                              pointerEvents: "none"
                            }}
                          />
                        )}
                        {/* Road half-dash lines between adjacent road columns */}
                        {row[c]?.type === "road" && row[c + 1]?.type === "road" && (
                          <div
                            style={{
                              position: "absolute",
                              right: 0,
                              top: 0,
                              width: "4px",
                              height: "100%",
                              background: "repeating-linear-gradient(to bottom, #D9D9D9 0 32px, transparent 32px 64px)",
                              zIndex: 2,
                              pointerEvents: "none"
                            }}
                          />
                        )}
                        {row[c]?.type === "road" && row[c - 1]?.type === "road" && (
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              width: "4px",
                              height: "100%",
                              background: "repeating-linear-gradient(to bottom, #D9D9D9 0 32px, transparent 32px 64px)",
                              zIndex: 2,
                              pointerEvents: "none"
                            }}
                          />
                        )}
                        {/* Car in this lane/column (top to bottom) */}
                        {carPositions.filter((car) => car.lane === l && car.col === c).map((car, i) => (
                          <motion.img
                            key={`car-${l}-${c}-${i}`}
                            src={CARS[car.carType || 0]}
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
                              zIndex: isDying ? 200 : 50, // above chicken when dying
                              imageRendering: "pixelated",
                              pointerEvents: "none"
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
                              bottom: "100%",
                              marginBottom: "40px",
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
                {/* Render all trees and bushes globally for correct z-index and overflow, INSIDE the board container */}
                {allDecos.map((deco, i) => (
                  <img
                    key={`deco-${i}`}
                    src={deco.img}
                    alt={deco.type}
                    style={{
                      position: "absolute",
                      left: deco.col * COL_WIDTH + deco.left,
                      top: deco.lane * (800 / LANES) + deco.top,
                      width: deco.type === "tree" ? 120 : 95,
                      height: deco.type === "tree" ? 150 : 84,
                      zIndex: 10 + deco.lane,
                      imageRendering: "pixelated",
                      pointerEvents: "none"
                    }}
                  />
                ))}
                {/* Render all coins globally for correct z-index */}
                {board[CENTER_LANE].map((tile, c) => (
                  <React.Fragment key={`coin-${c}`}>
                    {/* Coin only in chicken's lane, on roads, between crosswalks */}
                    {tile.hasCoin && (
                      <div
                        style={{
                          position: "absolute",
                          left: c * COL_WIDTH + COL_WIDTH * 0.5,
                          top: CENTER_LANE * (800 / LANES) + (800 / LANES) / 2,
                          transform: "translate(-50%, -50%)",
                          width: 85,
                          height: 85,
                          zIndex: 50,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: c === player.col + 1 ? "pointer" : "default"
                        }}
                        onClick={() => {
                          if (coinTapGuard.current) return;
                          coinTapGuard.current = true;
                          setTimeout(() => { coinTapGuard.current = false; }, 500);
                          if (c === player.col + 1 && !animating.current && !gameOver && !win && !cashedOut && !isDying) {
                            moveChicken();
                          }
                        }}
                        onTouchStart={e => {
                          e.preventDefault(); // Prevents iOS Safari from firing both touch and click events (double-action bug)
                          if (coinTapGuard.current) return;
                          coinTapGuard.current = true;
                          setTimeout(() => { coinTapGuard.current = false; }, 500);
                          if (c !== player.col + 1) return;
                          if (!animating.current && !gameOver && !win && !cashedOut && !isDying) {
                            moveChicken();
                          }
                        }}
                        className={c === player.col + 1 ? "next-claimable-coin" : undefined}
                      >
                        {/* Overlay highlight for hover/active */}
                        {c === player.col + 1 && <div className="coin-hover-overlay" />}
                        <img
                          src={COIN}
                          alt="coin"
                          style={{ width: 85, height: 85, imageRendering: "pixelated", position: "absolute", inset: 0 }}
                        />
                        <span className="pixel-font" style={{
                          position: "relative",
                          zIndex: 10,
                          color: "#fff",
                          fontWeight: "bold",
                          fontSize: 16,
                          textShadow: "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000"
                        }}>+{DIFFICULTY_MULTIPLIERS[difficulty][Math.min(c - 5, DIFFICULTY_MULTIPLIERS[difficulty].length - 1)].toFixed(2)}x</span>
                      </div>
                    )}
                    {/* Claimed coin marker (gold coin) for previously claimed coins */}
                    {claimedCoins.includes(c) && c < player.col && (
                      <div
                        style={{
                          position: "absolute",
                          left: c * COL_WIDTH + COL_WIDTH * 0.5,
                          top: CENTER_LANE * (800 / LANES) + (800 / LANES) / 2,
                          transform: "translate(-50%, -50%)",
                          width: 95,
                          height: 95,
                          zIndex: 50,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <img
                          src={COIN_FRAME}
                          alt="claimed coin"
                          style={{ width: 95, height: 95, imageRendering: "pixelated", position: "absolute", inset: 0 }}
                        />
                      </div>
                    )}
                    {/* Selector frame around the next claimable coin */}
                    {tile.hasCoin && c === player.col + 1 && (
                      <img
                        src={SELECTOR_FRAMES[selectorFrame]}
                        alt="selector"
                        style={{
                          position: "absolute",
                          left: c * COL_WIDTH + COL_WIDTH * 0.5,
                          top: CENTER_LANE * (800 / LANES) + (800 / LANES) / 2,
                          transform: "translate(-50%, -50%)",
                          width: selectorFrame === 1 ? 125 : 105,
                          height: selectorFrame === 1 ? 125 : 105,
                          zIndex: 51, // Above coin
                          pointerEvents: "none"
                        }}
                      />
                    )}
                  </React.Fragment>
                ))}
                {/* Render background cars globally for correct camera movement */}
                {backgroundCars.map((car, i) => (
                  <img
                    key={`bg-car-${i}`}
                    src={CARS[car.carType]}
                    alt="background car"
                    style={{
                      position: "absolute",
                      left: car.col * COL_WIDTH,
                      top: car.y * (800 / LANES),
                      width: COL_WIDTH,
                      height: (800 / LANES),
                      zIndex: 60, // Above coins, below chicken/kill cars
                      imageRendering: "pixelated",
                      pointerEvents: "none",
                      opacity: 1 // Normal opacity
                    }}
                  />
                ))}
                {/* Chicken absolutely positioned inside board container */}
                <img
                  src={isDying ? CHICKEN_DEAD_FRAMES[chickenAnimRef.current.frame] : CHICKEN_FRAMES[chickenAnimRef.current.frame]}
                  alt="chicken"
                  style={{
                    position: "absolute",
                    left: chickenAnimRef.current.col * COL_WIDTH + COL_WIDTH * 0.5,
                    top: CENTER_LANE * (800 / LANES) + (800 / LANES) / 2,
                    transform: "translate(-50%, -50%)",
                    width: isDying ? 180 : 100,
                    height: isDying ? 180 : 100,
                    zIndex: 150, // Very high z-index to appear above everything
                    imageRendering: "pixelated",
                    pointerEvents: "none",
                    transition: "left 0.3s ease-out"
                  }}
                  className="chicken-sprite"
                />
                {/* Cars absolutely positioned inside board container */}
                {carPositions.map((car, i) => (
                  <motion.img
                    key={`car-${i}`}
                    src={CARS[car.carType || 0]}
                    alt="car"
                    initial={{ scale: 1, opacity: 1, x: car.col * COL_WIDTH, y: car.y * (800 / LANES) }}
                    animate={{
                      x: car.col * COL_WIDTH,
                      y: car.y * (800 / LANES),
                      scale: 1,
                      opacity: 1
                    }}
                    exit={{ scale: 1, opacity: 0 }}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: COL_WIDTH,
                      height: (800 / LANES),
                      zIndex: isDying ? 200 : 50, // above chicken when dying
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
                      x: eagle.x * COL_WIDTH,
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
                      width: 200, // Bigger
                      height: 140, // Bigger
                      zIndex: 201, // Above chicken, coins, and background cars
                      imageRendering: "pixelated",
                      pointerEvents: "none"
                    }}
                  />
                ))}
              </motion.div>
            </div>
            {gameOver && !isDying && <div style={{ fontSize: 32, color: "red" }}>Game Over</div>}
            
            {/* Streak and Multiplier Tracker (Desktop) */}
            <div className="streak-multiplier-tracker">
              <div className="streak-multiplier-box">
                <div className="streak-multiplier-header">
                  <img 
                    src="/game/Chicken Walk V2/Chicken Walk V2 000.png" 
                    alt="Player" 
                    className="streak-multiplier-chicken"
                  />
                  <div className="streak-multiplier-values">
                    <div className="streak-multiplier-mult">
                      {currentMultiplier.toFixed(1)}x
                    </div>
                    <div className="streak-multiplier-bet">
                      Bet: ${betAmount}
                    </div>
                  </div>
                </div>
                <div className="streak-multiplier-winnings">
                  <div className="streak-multiplier-winnings-label">Current Winnings</div>
                  <div className="streak-multiplier-winnings-value">${currentWinnings}</div>
                </div>
                <div className="streak-multiplier-streak-row">
                  <span className="streak-multiplier-streak-count">{streak}</span>
                  <img 
                    src="/game/Custom Icons/Fire.png" 
                    alt="Streak" 
                    className="streak-multiplier-fire"
                  />
                  <span className="streak-multiplier-streak-label">streak</span>
                </div>
              </div>
            </div>

            {/* Streak and Multiplier Tracker (Mobile) */}
            <div className="streak-multiplier-tracker-mobile">
              <img 
                src="/game/Chicken Walk V2/Chicken Walk V2 000.png" 
                alt="Player" 
                className="streak-multiplier-chicken-mobile"
              />
              <div className="streak-multiplier-values-mobile">
                <div className="streak-multiplier-mult-mobile">{currentMultiplier.toFixed(1)}x</div>
                <div className="streak-multiplier-winnings-mobile">${currentWinnings}</div>
                <div className="streak-multiplier-streak-row-mobile">
                  <span className="streak-multiplier-streak-count-mobile">{streak}</span>
                  <img 
                    src="/game/Custom Icons/Fire.png" 
                    alt="Streak" 
                    className="streak-multiplier-fire-mobile"
                  />
                  <span className="streak-multiplier-streak-label-mobile">streak</span>
                </div>
              </div>
            </div>
      
            
            {/* Game Footer Controls */}
            <div className="game-footer-bar">
              <div className="game-footer-bg">
                <div className="game-footer-flex">
                  {/* Mobile Controls */}
                  <div className="game-footer-mobile">
                  <div className="footer-btn-wrap w-full"><button className="footer-big-btn"><img src="/game/UI/Big Button.png" alt="" className="footer-big-btn-bg" /><span className="footer-big-btn-text">Start Game</span></button></div>
                    <div className="footer-section">
                      <span className="footer-label">Difficulty</span>
                      <div className="footer-btn-row">
                        <div className="footer-btn-wrap flex-1"><button className={`footer-btn ${difficulty === 'easy' ? 'active' : 'inactive'}`} onClick={() => handleDifficultyChange('easy')}><img src={difficulty === 'easy' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">Easy</span></button></div>
                        <div className="footer-btn-wrap flex-1"><button className={`footer-btn ${difficulty === 'medium' ? 'active' : 'inactive'}`} onClick={() => handleDifficultyChange('medium')}><img src={difficulty === 'medium' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">Medium</span></button></div>
                        <div className="footer-btn-wrap flex-1"><button className={`footer-btn ${difficulty === 'hard' ? 'active' : 'inactive'}`} onClick={() => handleDifficultyChange('hard')}><img src={difficulty === 'hard' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">Hard</span></button></div>
                        <div className="footer-btn-wrap flex-1"><button className={`footer-btn ${difficulty === 'daredevil' ? 'active' : 'inactive'}`} onClick={() => handleDifficultyChange('daredevil')}><img src={difficulty === 'daredevil' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">Daredevil</span></button></div>
                      </div>
                    </div>
                    <div className="footer-section">
                      <span className="footer-label">Bet Amount</span>
                      <div className="footer-bet-input-container">
                        <input
                          type="number"
                          value={betAmount}
                          onChange={handleBetAmountChange}
                          className="footer-bet-input"
                          min="1"
                          max="1000"
                          step="1"
                        />
                        <span className="footer-bet-input-symbol">$</span>
                      </div>
                      <div className="footer-btn-row">
                        <div className="footer-btn-wrap"><button className={`footer-btn ${betFraction === '1/4' ? 'active' : 'inactive'}`} onClick={() => handleBetFractionClick('1/4')}><img src={betFraction === '1/4' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">1/4</span></button></div>
                        <div className="footer-btn-wrap"><button className={`footer-btn ${betFraction === '1/2' ? 'active' : 'inactive'}`} onClick={() => handleBetFractionClick('1/2')}><img src={betFraction === '1/2' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">1/2</span></button></div>
                        <div className="footer-btn-wrap"><button className={`footer-btn ${betFraction === '3/4' ? 'active' : 'inactive'}`} onClick={() => handleBetFractionClick('3/4')}><img src={betFraction === '3/4' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">3/4</span></button></div>
                        <div className="footer-btn-wrap"><button className={`footer-btn ${betFraction === 'MAX' ? 'active' : 'inactive'}`} onClick={() => handleBetFractionClick('MAX')}><img src={betFraction === 'MAX' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">MAX</span></button></div>
                      </div>
                    </div>
                  </div>
                  {/* Desktop Controls */}
                  <div className="game-footer-desktop">
                  <div className="footer-btn-wrap min-w-140"><button className="footer-big-btn"><img src="/game/UI/Big Button.png" alt="" className="footer-big-btn-bg" /><span className="footer-big-btn-text">Start Game</span></button></div>
                    <div className="footer-section">
                      <span className="footer-label">Difficulty</span>
                      <div className="footer-btn-row desktop">
                        <div className="footer-btn-wrap"><button className={`footer-btn ${difficulty === 'easy' ? 'active' : 'inactive'}`} onClick={() => handleDifficultyChange('easy')}><img src={difficulty === 'easy' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">Easy</span></button></div>
                        <div className="footer-btn-wrap"><button className={`footer-btn ${difficulty === 'medium' ? 'active' : 'inactive'}`} onClick={() => handleDifficultyChange('medium')}><img src={difficulty === 'medium' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">Medium</span></button></div>
                        <div className="footer-btn-wrap"><button className={`footer-btn ${difficulty === 'hard' ? 'active' : 'inactive'}`} onClick={() => handleDifficultyChange('hard')}><img src={difficulty === 'hard' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">Hard</span></button></div>
                        <div className="footer-btn-wrap"><button className={`footer-btn ${difficulty === 'daredevil' ? 'active' : 'inactive'}`} onClick={() => handleDifficultyChange('daredevil')}><img src={difficulty === 'daredevil' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">Daredevil</span></button></div>
                      </div>
                    </div>
                    <div className="footer-section bet-section">
                      <span className="footer-label">Bet Amount</span>
                      <div className="footer-bet-row">
                        <div className="footer-bet-input-container">
                          <input
                            type="number"
                            value={betAmount}
                            onChange={handleBetAmountChange}
                            className="footer-bet-input"
                            min="1"
                            max="1000"
                            step="1"
                          />
                          <span className="footer-bet-input-symbol">$</span>
                        </div>
                        <div className="footer-btn-row desktop">
                          <div className="footer-btn-wrap"><button className={`footer-btn ${betFraction === '1/4' ? 'active' : 'inactive'}`} onClick={() => handleBetFractionClick('1/4')}><img src={betFraction === '1/4' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">1/4</span></button></div>
                          <div className="footer-btn-wrap"><button className={`footer-btn ${betFraction === '1/2' ? 'active' : 'inactive'}`} onClick={() => handleBetFractionClick('1/2')}><img src={betFraction === '1/2' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">1/2</span></button></div>
                          <div className="footer-btn-wrap"><button className={`footer-btn ${betFraction === '3/4' ? 'active' : 'inactive'}`} onClick={() => handleBetFractionClick('3/4')}><img src={betFraction === '3/4' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">3/4</span></button></div>
                          <div className="footer-btn-wrap"><button className={`footer-btn ${betFraction === 'MAX' ? 'active' : 'inactive'}`} onClick={() => handleBetFractionClick('MAX')}><img src={betFraction === 'MAX' ? "/game/UI/Small Button Active.png" : "/game/UI/Small Button - inactive.png"} alt="" className="footer-btn-bg" /><span className="footer-btn-text">MAX</span></button></div>
                        </div>
                      </div>
                    </div>
      
                  </div>
                </div>
              </div>
            </div>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}