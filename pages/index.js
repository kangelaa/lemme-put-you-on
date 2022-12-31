import styles from '../styles/Home.module.css'
import {useState, useEffect} from 'react'
import {useRouter} from 'next/router';
import querystring from 'querystring'
import {generateChallenge} from '../utils/pkce';
import Game from './game';
import {turnIntoQuery, transformSpecialChar, setCharAt, getNicheData} from './utils.js'

// input the client id with the client id for your project
const CLIENT_ID = '4a5792d3ffe94918872538573d844c87';
const CALLBACK_URL = 'http://localhost:3000';
const SPOTIFY_CODE_VERIFIER = "spotify-code-verifier";
const Duration = {
  SHORT_TERM: 'short_term',
  MEDIUM_TERM: 'medium_term',
  LONG_TERM: 'long_term',
  HUNDRED_SONGS: 100,
  FIVEHUNDRED_SONGS: 500,
  ALLTIME_SONGS: true
  // LIKED_SONGS: // TODO: FIND 
};

Object.freeze(Duration);

const Category = {
  ARTISTS: 'artists',
  TRACKS: 'tracks'
};

Object.freeze(Category);

export default function Home() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [authCode, setAuthCode] = useState();
    const [accessToken, setAccessToken] = useState();
    const [topSongs, setTopSongs] = useState([]);
    const router = useRouter();

    useEffect(() => {
        const token = window.localStorage.getItem("token");
        setLoggedIn(!!token);
    }, []);

    useEffect(() => {
        // retrieve the authorization code from the query params on callback
        const code = router.query.code;
        if (!code) return;
        setAuthCode(code);
    }, [router]);

    useEffect(() => {
        if (authCode) void getAccessToken();
    }, [authCode]);

    useEffect(() => {
        if (accessToken) setLoggedIn(true);
    }, [accessToken]);

    const login = async () => {
        const {code_challenge, code_verifier} = await generateChallenge();
        window.localStorage.setItem(SPOTIFY_CODE_VERIFIER, code_verifier);
        const authenticationUrl = 'https://accounts.spotify.com/authorize?' +
            querystring.stringify({
                // fill in the query params for the authorize /endpoint
                client_id: CLIENT_ID, // set this alr
                response_type: 'code',
                scope: 'user-top-read user-library-read', // reading from user's top songs and artists TODO: CHECK THIS!
                redirect_uri: CALLBACK_URL,
                show_dialog: true, // prompts user for login if true
                code_challenge_method: 'S256', // hash it using S256 algo
                code_challenge
            });
        void router.push(authenticationUrl);
    }

    const getAccessToken = async () => {
        const code_verifier = window.localStorage.getItem(SPOTIFY_CODE_VERIFIER);
        if (!code_verifier) return;

        const res = await window.fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;',
            },
            body: querystring.stringify({
               // fill in the parameters needed for the body of the POST /api/token request
               grant_type: 'authorization_code',
               code: authCode, // give authCode
               redirect_uri: CALLBACK_URL, // ensure it's the same webapp
               client_id: CLIENT_ID,
               code_verifier: code_verifier, // random string hashed earlier, 
               //sending them unhashed vers Spot will check
            })
        });

        const body = await res.json();
        // save the access_token from the body
        setAccessToken(body.access_token);
    }

    const fetchTopSongs = async (duration) => {
        const response1 = await window.fetch('https://api.spotify.com/v1/me/top/tracks?' +
            querystring.stringify({
              // fill in the body parameters needed for the /top/tracks endpoint
              limit: 50,
              offset: 0,
              time_range: duration,
            }), {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + accessToken,
            },
        });
        const data1 = await response1.json()
        const response2 = await window.fetch('https://api.spotify.com/v1/me/top/tracks?' +
            querystring.stringify({
              // fill in the body parameters needed for the /top/tracks endpoint
              limit: 50,
              offset: 49, 
              time_range: duration,
            }), {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + accessToken,
            },
        });
        const data2 = await response2.json()
        const data = [...data1.items,...data2.items]
        data.splice(50,1) // remove duplicate item
        const results = data.map(song => [song.id,song.name,song.artists[0].name,song.album.images[0].url,song.popularity,song.available_markets])
        setTopSongs(results)
        //console.table(results)
        
        //loop through results, check for popularity score mishaps (unplayable duplicate versions, etc.) and try to resolve, delete from array if unable
        results = await checkDuplicateSongs(results)
        
        getNicheData(results)
    }

    const fetchLikedSongs = async (duration) => {
        const data = []
        let track_count = 0
        let offset = 0;

        //check for total liked songs # and TOOD: make sure user has liked songs 
        const fetchTotalResponse = await window.fetch('https://api.spotify.com/v1/me/tracks?' +
        querystring.stringify({
          // fill in the body parameters needed for the /top/tracks endpoint
          limit: 1,
          offset: offset,
          //market: , // TODO
        }), {
        method: 'GET',
        headers: {
            Authorization: 'Bearer ' + accessToken,
        },
        });
        const checkData = await fetchTotalResponse.json()
        const totalResults = checkData.total

        console.log(totalResults)

        if (duration === true || totalResults < duration){
            duration = totalResults
        } 

        if (totalResults !== 0){
            while (true){
                if (track_count >= duration){ 
                    break;
                }
                const response1 = await window.fetch('https://api.spotify.com/v1/me/tracks?' +
                querystring.stringify({
                  // fill in the body parameters needed for the /top/tracks endpoint
                  limit: 50,
                  offset: offset,
                  //market: , // TODO
                }), {
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + accessToken,
                },
                });
                const tempData = await response1.json()
                data = [...data,...tempData.items]
                offset+=50
                track_count+=50
            }
    
            let results = data.map(song => [song.track.id,song.track.name,song.track.artists[0].name,song.track.album.images[0].url,song.track.popularity,song.track.available_markets])
            setTopSongs(results)
            console.table(results)
            
            //loop through results, check for popularity score mishaps (unplayable duplicate versions, etc.) and try to resolve, delete from array if unable
            results = await checkDuplicateSongs(results)
            
            getNicheData(results)
        }
    }
 
    const fetchTopArtists = async (duration) => {
        const response1 = await window.fetch('https://api.spotify.com/v1/me/top/artists?' +
            querystring.stringify({
              // fill in the body parameters needed for the /top/tracks endpoint
              limit: 50,
              offset: 0,
              time_range: duration,
            }), {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + accessToken,
            },
        });
        const data1 = await response1.json()
        const response2 = await window.fetch('https://api.spotify.com/v1/me/top/artists?' +
            querystring.stringify({
              // fill in the body parameters needed for the /top/tracks endpoint
              limit: 50,
              offset: 49, 
              time_range: duration,
            }), {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + accessToken,
            },
        });
        const data2 = await response2.json()
        const data = [...data1.items,...data2.items]
        data.splice(50,1) // remove duplicate item
        const results = data.map(artist => [artist.id,artist.name,artist.type,artist.images[0].url,artist.popularity])
        setTopSongs(results)
        console.table(results)
    
        getNicheData(results)
    }

    async function checkDuplicateSongs(arr){
        for (let i=0; i<arr.length; i++){ // CHECK TIMING ON THIS (statements w/o await)...TODO: NEED ASYNC?
            if(arr[i][5].length===0){ // check for song duplicates, link correct version // TODO: FIX THIS index # and === LATER 
                // use spotify search
                const link = 'https://api.spotify.com/v1/search?' +
                    'q=' + turnIntoQuery(arr[i][1],arr[i][2]) + '&' + 
                    querystring.stringify({
                    // fill in the body parameters needed for the /top/tracks endpoint
                      //q: turnIntoQuery(results[i][1],results[i][2]),
                      type: "track", 
                      limit: 5,
                })
                console.log(link)
                const dupTrackResponse = await window.fetch(link, {
                    method: 'GET',
                    headers: {
                        Authorization: 'Bearer ' + accessToken,
                    },
                });
                const dupTrackDatas = await dupTrackResponse.json() 
                let dupTrackData = [...dupTrackDatas.tracks.items] 
                if(dupTrackData[0]!==undefined){ // MAKE SURE THERE'S DATA!!! -> keep code from crashing if not
                    dupTrackData = dupTrackData.map(song => [song.id,song.name,song.artists[0].name,song.album.images[0].url,song.popularity,song.available_markets])
                    const sortedTrackData = dupTrackData.sort((a,b) => b[4] - a[4])
                    for (let j=0; j<sortedTrackData.length; j++){ //TODO: CHECK taking first popularity sorted result gives an ok result - esp for acoustic/remixes etc (check cosmo pyke social sites acoustic results ex.)
                        if (arr[i][1] === sortedTrackData[j][1] && arr[i][2] === sortedTrackData[j][2]){
                            arr[i] = sortedTrackData[j]
                            break;
                        }
                    }
                    if (arr[i][5].length===0){
                        arr.splice(i,1)  //if first 5 sorted don't match, splice 
                        i--
                    }
                } else { // if can't find song results, empty response -> delete that song
                    arr.splice(i,1)
                    i--
                }
                console.table(arr)
            }
        }
        return arr
    }

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <h1 className={styles.title}> Lemme Put You On </h1>
                  {loggedIn ?
                      <div className={`${styles.grid} ${styles.options}`}>
                        {/*TODO: CHANGE BUTTONS HERE TO ACCOUNT FOR TYPE AND DURATION SELECTION - HAVE TO FIGURE OUT HOW U WANT WEBSITE TO WORK!*/}
                          <div className={`${styles.card} ${styles.btn}`} onClick={() => fetchTopArtists(Duration.SHORT_TERM)}>
                              <h2>Artists Last 4 Weeks</h2>
                          </div>
                          <div className={`${styles.card} ${styles.btn}`} onClick={() => fetchTopArtists(Duration.MEDIUM_TERM)}>
                              <h2>Artists Last 6 months</h2>
                          </div>
                          <div className={`${styles.card} ${styles.btn}`} onClick={() => fetchTopArtists(Duration.LONG_TERM)}>
                              <h2>Artists All Time</h2>
                          </div>
                          <div className={`${styles.card} ${styles.btn}`} onClick={() => fetchTopSongs(Duration.SHORT_TERM)}>
                              <h2>Songs Last 4 Weeks</h2>
                          </div>
                          <div className={`${styles.card} ${styles.btn}`} onClick={() => fetchTopSongs(Duration.MEDIUM_TERM)}>
                              <h2>Songs Last 6 months</h2>
                          </div>
                          <div className={`${styles.card} ${styles.btn}`} onClick={() => fetchTopSongs(Duration.LONG_TERM)}>
                              <h2>Songs All Time</h2>
                          </div>
                          <div className={`${styles.card} ${styles.btn}`} onClick={() => fetchLikedSongs(Duration.HUNDRED_SONGS)}>
                              <h2>100 Liked Songs</h2>
                          </div>
                          <div className={`${styles.card} ${styles.btn}`} onClick={() => fetchLikedSongs(Duration.FIVEHUNDRED_SONGS)}>
                              <h2>500 Liked Songs</h2>
                          </div>
                          <div className={`${styles.card} ${styles.btn}`} onClick={() => fetchLikedSongs(Duration.ALLTIME_SONGS)}>
                              <h2>All Liked Songs</h2>
                          </div>
                      </div>
                     :
                      <div className={`${styles.card} ${styles.btn} ${styles.options}`} onClick={login}>
                          <h2>Log In with Spotify</h2>
                      </div>
                  }
                  <Game topSongs={topSongs}/>
            </main>
      </div>
    )
}