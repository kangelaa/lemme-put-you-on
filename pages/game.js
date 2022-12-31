import {getNumber, getRandomInt} from './utils.js'
import {useState, useEffect} from 'react'
import styles from '../styles/Home.module.css'

export default function Game(props) {
  const [revealed, setRevealed] = useState([]);
  const [curGuess, setCurGuess] = useState(0);
  const [curSongs, setCurSongs] = useState([]);
  const [totalGuesses, setTotalGuesses] = useState(0);

  const {topSongs} = props;
  //console.log(topSongs[1])
  const showTopSongs = topSongs.map((song, idx) =>
    revealed[idx] ? <li key={idx} className={styles.listItem}>{idx + 1}. {song[0]}</li> : <li key={idx} className={styles.listItem}>{idx + 1}. ???</li>
  );

  const reset = () => {
    setRevealed([]);
    setCurGuess(0);
    setCurSongs([]);
    setTotalGuesses(0);
  }

  useEffect(() => {
    reset();
  }, [topSongs]);

  useEffect(() => {
    if (curSongs.length == 0 && topSongs.length > 0 && curGuess == 0) {
        generateGuesses(curGuess);
    }
}, [curSongs, topSongs]);

  const generateGuesses = (curGuessNum) => {
    const tempSongs = []
    const size = Math.min(4, topSongs.length - curGuessNum)
    const answerIdx = getRandomInt(0, size);

    for (let i = 0; i < size; i++) {
        if (i === answerIdx) {
            tempSongs.push(topSongs[curGuessNum])
        }
        else {
            var randomSong;
            do {
                randomSong = topSongs[getRandomInt(curGuessNum + 1, topSongs.length)];
            } while (tempSongs.includes(randomSong))

            tempSongs.push(randomSong)
        }
    }

    setCurSongs(tempSongs)
  } 

  const reveal = (guess) => {
    setTotalGuesses(totalGuesses + 1);
    if (guess === topSongs[curGuess]) {
        const newRevealed = [...revealed]
        newRevealed[curGuess] = true;

        setRevealed(newRevealed);
        setCurGuess(curGuess + 1);
        generateGuesses(curGuess + 1)
    }
  }

  return (
    topSongs.length > 0 &&
    <div className={styles.grid}>
        <div className={styles.column}>
            <ul className={styles.topSongs}>
                {showTopSongs}
            </ul>
        </div>
        <div className={styles.column}>
            {curGuess < topSongs.length &&
                <h1>Guess Your {getNumber(curGuess)} Top Song</h1>
            }
            <div className={styles.grid}>
                {
                    curSongs.map((song, i) =>
                        <div key={song + i} onClick={() => reveal(curSongs[i])} className={`${styles.card} ${styles.btn}`}>
                            <h2>{song}</h2>
                        </div>
                    )
                }
            </div>
            {totalGuesses > 0 && <h1>Correctness: {Math.round(curGuess / totalGuesses * 100)}&#x25;</h1>}
        </div>
    </div>
  )
}