/**
 * Developed by Ricardo Schutz <ricardo@rascode.com.br>
 */

function getRandom(max, min) {
    if (!min) min = 0
    return (Math.floor(Math.random() * 1000000) % max) + min
}

class SnakeGameState {

    constructor(options) {
        this.startSize = options.startSize || 3
        this.interval = options.interval || 200
        this.newDirection = options.newDirection || 1
        this.lastDirection = options.lastDirection || 1
        this.positionL = options.positionL || 13
        this.positionC = options.positionC || 0
        this.grow = options.grow || []
        this.lastKey = options.lastKey || ''
        this.directionQueue = options.directionQueue || []
        this.tick = options.tick || 0
        this.apples = options.apples || []
        this.dead = options.dead || false
        this.elemScore = options.elemScore || null
        this.elemLevel = options.elemLevel || null
        this.elemApples = options.elemApples || null
        this.score = options.score || 0
        this.level = options.level || 0
        this.applesCount = options.applesCount || 0
        this.bonuses = options.bonuses || []
        this.bonusActive = options.bonusActive || false
    }
}

class SnakeGameBonus {
    get TYPES() { return [
        {
            name: 'matrix',
            duration: {
                min: 10000,
                max: 20000 // miliseconds plus min. If max == min, duration is fixed to min
            },
            points: {
                min: 2,
                max: 2
            },
            timeout: {
                min: 30,
                max: 100
            }
        },

        {
            name: 'half',
            points: {
                min: 2,
                max: 2
            },
            timeout: {
                min: 30,
                max: 120
            }
        }
    ]}

    constructor(options) {
        if (options) {
            this.type = options.type
            this.duration = options.duration || 0
            this.points = options.points || 0
            this.timeout = options.timeout || 0
        } else {
            this.type = this.TYPES[getRandom(this.TYPES.length)]
            this.duration = this.type.duration ? getRandom(this.type.duration.max, this.type.duration.min) : 0
            this.points = getRandom(this.type.points.max, this.type.points.min)
            this.timeout = getRandom(this.type.timeout.max, this.type.timeout.min)
        }
    }

    apply(game) {
        switch (this.type.name) {
            case 'matrix':
                game.gameState.bonusActive = true
                game.addScore(this.points)
                game.gameState.blockLevelChange = true
                let originalInterval = game.gameState.interval
                game.gameState.interval = 400 // Math.floor(game.gameState.interval * 3)
                game.screen.setAttribute('matrix','')
                if (this.duration > 0) {
                    let id = game.gameID
                    setTimeout(() => {
                        game.gameState.bonusActive = false
                        game.gameState.interval = originalInterval
                        game.gameState.blockLevelChange = false
                        game.screen.removeAttribute('matrix')
                    }, this.duration);
                }
                break;
                
            case 'half':
                game.addScore(this.points)
                for (let i=0; i<Math.floor(game.snake.length / 2); i++) {
                    game.unsetPixel(game.snake.pop())
                }
                break;
        }
    }
}

class SnakeGame {

    constructor(screen, gameState, recording) {

        this.CONF = {
            EAST: 1,
            SOUTH: 2,
            WEST: 3,
            NORTH: 4,
            MAX_COLUMNS: 25,
            MAX_LINES: 25,
            SPEEDS: {},
            SPEED_THRESHOLDS: [ 200, 500, 900, 1500, 2300, 3300 ], // ticks
            GROW_PERIOD: 100,          // ticks
            APPLE_PROBABILITY: 8,      // Percentage
            APPLE_MAX_TIMEOUT: 80,     // ticks
            APPLE_MIN_TIMEOUT: 20,     // ticks
            APPLE_MAX_SCORE: 12,       // score
            APPLE_MIN_SCORE: 6,
            MAX_BONUSES: 1,
            BONUS_PROBABILITY: 1
        }

        Object.defineProperty(this, 'isPlaying', {
            get() { return this._isPlaying },
            set(newValue) {
                this._isPlaying = newValue
                this.notifyChangeListeners()
            }
        })

        this.gameID = 0

        this.screen = screen

        this.initializeSpeeds()

        if (recording) {
            this.recording = recording
            this.playGame(recording)
        } else {
            this.newGame(screen, gameState)
        }

    }

    addChangeListener(l) {
        if (!this._changeListeners) this._changeListeners = []
        this._changeListeners.push(l)
        l()
    }

    removeChangeListener(l) {
        let index = this._changeListeners.indexOf(l)
        if (index >= 0) {
            this._changeListeners.splice(index, 1)
        } else if (typeof l == 'number' && l != NaN && l >= 0 && l < this._changeListeners.length) {
            this._changeListeners.splice(l, 1)
        }
    }

    notifyChangeListeners() {
        if (!this._changeListeners) return
        for (let l of this._changeListeners) {
            if (typeof l == "function") l()
        }
    }

    onGameEnd(fn) {
        this._onGameEnd = fn
    }

    initializeSpeeds() {
        this.CONF.SPEEDS[`0`] = 200
        this.CONF.SPEEDS[`${this.CONF.SPEED_THRESHOLDS[0]}`] = 160
        this.CONF.SPEEDS[`${this.CONF.SPEED_THRESHOLDS[1]}`] = 120
        this.CONF.SPEEDS[`${this.CONF.SPEED_THRESHOLDS[2]}`] = 90
        this.CONF.SPEEDS[`${this.CONF.SPEED_THRESHOLDS[3]}`] = 65
        this.CONF.SPEEDS[`${this.CONF.SPEED_THRESHOLDS[4]}`] = 40

        // this.CONF.SPEEDS[`0`] = 30000
        // this.CONF.SPEEDS[`${this.CONF.SPEED_THRESHOLDS[0]}`] = 30000
        // this.CONF.SPEEDS[`${this.CONF.SPEED_THRESHOLDS[1]}`] = 120
        // this.CONF.SPEEDS[`${this.CONF.SPEED_THRESHOLDS[2]}`] = 90
        // this.CONF.SPEEDS[`${this.CONF.SPEED_THRESHOLDS[3]}`] = 65
        // this.CONF.SPEEDS[`${this.CONF.SPEED_THRESHOLDS[4]}`] = 40
    }

    setPixel(elem) {
        elem.setAttribute('state','on')
    }
    
    unsetPixel(elem) {
        elem.setAttribute('state','off')
    }

    createPixel() {
        var pixel = document.createElement("div")
        pixel.setAttribute('pixel','')
        pixel.setAttribute('state','off')
        return pixel
    }
    
    createLine() {
        var line = document.createElement("div")
        line.setAttribute('line','')
        return line
    }

    clearScreen() {
        for (let l=0; l<this.CONF.MAX_LINES; l++) {
            for (let c=0; c<this.CONF.MAX_COLUMNS; c++) {
                this.unsetPixel(this.snakePixels[l][c])
            }
        }
        this.screen.removeAttribute('matrix')
    }

    generateApple() {

        if (this.isPlaying) {
            let newApples = []
            for (let apple of this.gameState.apples) {
                let pixel = this.snakePixels[apple.position.line][apple.position.column]
                pixel.setAttribute('state','apple')
                pixel.position = { line: apple.line, column: apple.column }
                pixel.appleTimeout = apple.appleTimeout
                pixel.appleScore = apple.appleScore
                newApples.push(apple)
            }
            this.gameState.apples = newApples
            return
        }

        if (this.gameState.apples.length < 2 && Math.floor(Math.random() * 100) < this.CONF.APPLE_PROBABILITY) {
            let column = Math.floor(Math.random() * 100) % this.CONF.MAX_COLUMNS,
                line = Math.floor(Math.random() * 100) % this.CONF.MAX_LINES
    
            // If generated over the snake, try again once
            if (this.snakePixels[line][column].getAttribute('state') == 'on') {
                return this.generateApple()
            }
    
            this.snakePixels[line][column].setAttribute('state','apple')
            this.snakePixels[line][column].position = { line: line, column: column }
            this.snakePixels[line][column].appleTimeout = ((Math.floor(Math.random() * 100) % this.CONF.APPLE_MAX_TIMEOUT) + this.CONF.APPLE_MIN_TIMEOUT) * this.gameState.level
            this.snakePixels[line][column].appleScore = (Math.floor(Math.random() * 100) % this.CONF.APPLE_MAX_SCORE) + this.CONF.APPLE_MIN_SCORE
            
            this.gameState.apples.push(this.snakePixels[line][column])
        }
    }

    generateBonus() {
        if (!this.gameState.bonuses) this.gameState.bonuses = []

        if (this.isPlaying) {
            let newBonuses = []
            for (let bonus of this.gameState.bonuses) {
                let b = new SnakeGameBonus(bonus)
                b.position = bonus.position
                let pixel = this.snakePixels[bonus.position.line][bonus.position.column]
                pixel.setAttribute('state', 'bonus')
                pixel.setAttribute('bonus', b.type.name)
                pixel.bonus = b
                newBonuses.push(b)
            }
            this.gameState.bonuses = newBonuses
            return
        }

        if (!this.gameState.bonusActive && this.gameState.bonuses.length < this.CONF.MAX_BONUSES && Math.floor(Math.random() * 100) < this.CONF.BONUS_PROBABILITY) {
            let column = getRandom(this.CONF.MAX_COLUMNS),
                line = getRandom(this.CONF.MAX_LINES)
    
            // If generated over the snake, try again
            if (this.snakePixels[line][column].getAttribute('state') != 'off') {
                return this.generateBonus()
            }
    
            let bonus = new SnakeGameBonus()
            bonus.position = {
                line: line,
                column: column
            }
            this.gameState.bonuses.push(bonus)
            this.snakePixels[line][column].setAttribute('state', 'bonus')
            this.snakePixels[line][column].setAttribute('bonus', bonus.type.name)
            this.snakePixels[line][column].bonus = bonus
        }
    }

    consumeBonus(pixel) {
        // Check for bonus
        if (pixel.getAttribute('state') == 'bonus') {
            this.addScore(pixel.bonus.points)
            this.gameState.bonuses.splice(this.gameState.bonuses.indexOf(pixel.bonus),1)
            pixel.removeAttribute('bonus')
            pixel.bonus.apply(this)
            delete pixel.bonus
        }
    }

    setScoreElement(elem) {
        this.elemScore = elem
    }

    setLevelElement(elem) {
        this.elemLevel = elem
    }

    setApplesElement(elem) {
        this.elemApples = elem
    }

    renderScore() {
        this.elemScore && (this.elemScore.innerHTML = `Score: ${this.gameState.score}`)
        this.elemLevel && (this.elemLevel.innerHTML = `Level: ${this.gameState.level}`)
        this.elemApples && (this.elemApples.innerHTML = `Apples: ${this.gameState.applesCount}`)
    }

    addScore(value) {
        this.gameState.score += value * this.gameState.level
        this.renderScore()
    }

    eatApple(pixel) {
        // Check for apple
        if (pixel.getAttribute('state') == 'apple') {
            this.addScore(pixel.appleScore)
            delete pixel.appleTimeout
            this.gameState.apples.splice(this.gameState.apples.indexOf(pixel),1)
            this.gameState.grow.push(true)
            this.gameState.applesCount++
        }
    }

    clicked(key, event) {
    
        // Removes the delay of the browser trying to guess wether it's a hold or drag action
        if (event) event.preventDefault()

        if (this.isPlaying) return

        // If it's dead, start new game
        if (this.isDead() && this.canRestart && /^Arrow(Up|Down|Left|Right)$/i.test(key)) {
            this.newGame()
            this.start()
            return
        }
    
        if (this.gameState.lastKey == key) {
            return
        }

        this.gameState.lastKey = key
        
        let lastDir = this.gameState.newDirection
        
        if (this.gameState.directionQueue.length > 0) {
            lastDir = this.gameState.directionQueue[this.gameState.directionQueue.length - 1]
        }
        
        switch (key) {
            case "ArrowUp": this.gameState.newDirection = lastDir != this.CONF.SOUTH ? this.CONF.NORTH : this.gameState.newDirection ; break
            case "ArrowDown": this.gameState.newDirection = lastDir != this.CONF.NORTH ? this.CONF.SOUTH : this.gameState.newDirection ; break
            case "ArrowLeft": this.gameState.newDirection = lastDir != this.CONF.EAST ? this.CONF.WEST : this.gameState.newDirection ; break
            case "ArrowRight": this.gameState.newDirection = lastDir != this.CONF.WEST ? this.CONF.EAST : this.gameState.newDirection ; break
            
            // TODO: Testing purpose. Remove!
            // case "z": this.gameState.grow.push(true) ; break
        }

        this.gameState.directionQueue.unshift(this.gameState.newDirection)
    }

    createScreen(elem) {
        
        elem.innerHTML = ""

        this.snakePixels = {}

        for (let l=0; l<this.CONF.MAX_LINES; l++) {
            let column = {}
        
            let line = this.createLine()
        
            for (let c=0; c<this.CONF.MAX_COLUMNS; c++) {
                column[c] = this.createPixel()
                line.appendChild(column[c])
            }
        
            this.snakePixels[l] = column
        
            elem.appendChild(line)
        
        }

    }

    died(pixel) {
        // Snake eating itself
        if (this.snake.indexOf(pixel) >= 0) {
            this.snake[0].setAttribute('state','dead')
            this.gameState.dead = true
            setTimeout(() => {
                this.canRestart = true
            }, 1000)
            return true
        }
        return false
    }

    moveSnake(direction) {
        switch (direction) {
            case this.CONF.EAST: this.gameState.positionC = ++this.gameState.positionC % this.CONF.MAX_COLUMNS ; break
            case this.CONF.SOUTH: this.gameState.positionL = ++this.gameState.positionL % this.CONF.MAX_LINES ; break
            case this.CONF.WEST: this.gameState.positionC = this.gameState.positionC == 0 ? this.CONF.MAX_COLUMNS - 1 : --this.gameState.positionC % this.CONF.MAX_COLUMNS ; break
            case this.CONF.NORTH: this.gameState.positionL = this.gameState.positionL == 0 ? this.CONF.MAX_LINES - 1 : --this.gameState.positionL % this.CONF.MAX_LINES ; break
        }
    
        let pixel = this.snakePixels[this.gameState.positionL][this.gameState.positionC]
    
        this.eatApple(pixel)

        this.consumeBonus(pixel)
    
        this.setPixel(pixel)

        if (this.died(pixel)) return false
    
        this.snake.unshift(pixel)
    
        if (this.gameState.grow.length == 0) this.unsetPixel(this.snake.pop())
        else this.gameState.grow.pop()
    
        return true
    }

    recordNext(state) {
        this.recording.push(JSON.parse(JSON.stringify(state)))
    }

    playGame(recording) {
        this.gameID ++
        this.playing = JSON.parse(JSON.stringify(recording))
        this.isPlaying = true
        this.gameState = new SnakeGameState({})
        this.createScreen(this.screen)
        this.clearScreen()
        this.createStartingSnake(this.gameState.startSize)
        this.mainLoop()
    }

    mainLoop() {

        if (this.isPlaying) {
            this.gameState = this.playing.shift() || this.gameState
        } else {
            this.recordNext(this.gameState)
        }

        this.gameState.lastDirection = this.gameState.newDirection
    
        // Wether it's time to grow
        if (this.gameState.tick % this.CONF.GROW_PERIOD == 0) {
            this.gameState.grow.push(true)
            this.gameState.score += 2 * this.gameState.level
        }

        this.generateApple()
        this.generateBonus()
    
        // Move the snake and check if died
        if (!this.moveSnake(this.gameState.directionQueue.pop() || this.gameState.newDirection)) {
            this.gameState.dead = true
            
            // let id = 0 + this.gameID
            if (typeof this._onGameEnd == 'function') this._onGameEnd(this.gameID)
            
            return
        }
    
        // Speed up
        if (this.CONF.SPEEDS[`${this.gameState.tick}`]) {

            // If there's a bonus blocking level change, store for later
            if (this.gameState.blockLevelChange) {
                this.gameState.intervalAfterBlock = this.CONF.SPEEDS[`${this.gameState.tick}`]
            } else {
                this.gameState.interval = this.CONF.SPEEDS[`${this.gameState.tick}`]
                this.gameState.level++
            }
        }

        // Speed up after blocking bonus
        if (!this.gameState.blockLevelChange && this.gameState.intervalAfterBlock > 0) {
            this.gameState.interval = this.gameState.intervalAfterBlock
            this.gameState.intervalAfterBlock = 0
            this.gameState.level++
        }
    
        // Check apples timeouts
        for (let i in this.gameState.apples) {
            let pixel
            if (this.isPlaying) {
                let applePos = this.gameState.apples[i].position
                pixel = this.snakePixels[applePos.line][applePos.column]
            } else {
                pixel = this.gameState.apples[i]
            }
            if (pixel.appleTimeout-- <= 0) {
                this.unsetPixel(pixel)
                this.gameState.apples.splice(i,1)
            }
        }
    
        // Check bonuses timeouts
        for (let i in this.gameState.bonuses) {
            let pixel
            let bonusPos = this.gameState.bonuses[i].position
            if (this.isPlaying) {
                pixel = this.snakePixels[bonusPos.line][bonusPos.column]
            } else {
                pixel = this.snakePixels[bonusPos.line][bonusPos.column]
            }
            if (pixel.bonus && pixel.bonus.timeout-- <= 0) {
                this.unsetPixel(pixel)
                pixel.removeAttribute('bonus')
                delete pixel.bonus
                this.gameState.bonuses.splice(i,1)
            }
        }
    
        this.renderScore()
    
        this.gameState.lastKey = ''

        this.gameState.tick++

        let id = 0 + this.gameID
        setTimeout(() => {
            if (id == this.gameID) this.mainLoop()
        }, this.gameState.interval)
        
    }

    createStartingSnake(startSize) {
        this.snake = []
        // Creates the starting snake
        for (let i=0; i<startSize; i++) {
            var p = this.snakePixels[this.gameState.positionL][++this.gameState.positionC]
            this.setPixel(p)
            this.snake.unshift(p)
        }
    }

    newGame(screen, gameState) {

        this.gameID++

        this.recording = []

        this.snake = []

        // Is Playing a recorded game
        this.isPlaying = false

        this.gameState = gameState || new SnakeGameState({})

        this.canRestart = false
    
        this.createScreen(screen || this.screen)

        this.clearScreen()

        this.createStartingSnake(this.gameState.startSize)

    }

    isDead() {
        return this.gameState.dead
    }

    start() {
    
        // Starts the game after 3 seconds
        setTimeout(() => {
            this.mainLoop()
        })
    
    }

}

var xmlhttp = new XMLHttpRequest();

function fetchURL(url) {
    return new Promise((resolve,reject) => {

        xmlhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                return resolve(this.responseText)
            }
        };

        xmlhttp.open('GET', url);
        xmlhttp.send();
    })
}

function bindButtons(game) {
    for (let b of document.querySelectorAll('[button][up]')) {
        b.addEventListener('touchstart', (e) => game.clicked('ArrowUp', e))
    }
    for (let b of document.querySelectorAll('[button][left]')) {
        b.addEventListener('touchstart', (e) => game.clicked('ArrowLeft', e))
    }
    for (let b of document.querySelectorAll('[button][right]')) {
        b.addEventListener('touchstart', (e) => game.clicked('ArrowRight', e))
    }
    for (let b of document.querySelectorAll('[button][down]')) {
        b.addEventListener('touchstart', (e) => game.clicked('ArrowDown', e))
    }
}

function onReady(fn) {
    if (document.attachEvent ? document.readyState === "complete" : document.readyState !== "loading"){
        fn()
    } else {
        document.addEventListener('DOMContentLoaded', fn)
    }
}

function renderPlaying(isPlaying) {
    let elems = document.querySelectorAll('[is-playing]')
    for (let e of elems)
        e.setAttribute('is-playing',isPlaying?'true':'false')
}



class PWA {

    registerServiceWorker() {
        return new Promise((resolve, reject) => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('./sw.js')
                .then((reg) => {
                    this.registration = reg
                    return resolve(reg)
                })
                .catch((err) => reject(err))
            } else {
                reject('No serviceWorker in navigator.')
            }
        });
    }

    constructor() {
        this.registration = null
    }
}

class Deferred {
    constructor() {
        this.promise = new Promise((res, rej) => {
            this.resolve = res
            this.reject = rej
        })
    }
}
class SnakeDB {
    constructor(version) {
        this._ready = new Deferred()
        this.ready = this._ready.promise
        // In the following line, you should include the prefixes of implementations you want to test.
        this.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
        // DON'T use "var indexedDB = ..." if you're not in a function.
        // Moreover, you may need references to some window.IDB* objects:
        this.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction || {READ_WRITE: "readwrite"} // This line should only be needed if it is needed to support the object's constants for older browsers
        this.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange
        // (Mozilla has never prefixed these objects, so we don't need window.mozIDB*)

        this.version = version
        this.request = this.indexedDB.open('snake', version)
        this.request.onerror = e => this.onOpenError.call(this,e)
        this.request.onsuccess = e => this.onOpenSuccess.call(this,e)
        this.request.onupgradeneeded = e => this.initialize.call(this,e)
    }

    onOpenError(e) {
        console.error('Não foi possível iniciar o indexDB')
    }

    onOpenSuccess(e) {
        this.db = e.target.result
        if (!this.isUpgrading) this._ready.resolve(this)
    }

    initialize(e) {
        this.isUpgrading = true
        this.db = e.target.result
        let objStore = this.db.createObjectStore('recording', { autoIncrement: true })
        objStore.transaction.oncomplete = event => this._ready.resolve(this)
    }

    getAll(objName) {
        let d = new Deferred()
        this.db.transaction(objName, 'readwrite').objectStore(objName).getAll()
            .onsuccess = e => d.resolve(e.target.result)
        return d.promise
    }

    getAllKeys(objName) {
        let d = new Deferred()
        this.db.transaction(objName, 'readwrite').objectStore(objName).getAllKeys()
            .onsuccess = e => d.resolve(e.target.result)
        return d.promise
    }

    getLast(objName) {
        return this.getAllKeys(objName).then(keys => {
            return this.get(objName, keys[keys.length - 1])
        })
    }
    
    get(objName, key) {
        let d = new Deferred()
        this.db.transaction(objName, 'readwrite').objectStore(objName).get(key)
            .onsuccess = e => d.resolve(e.target.result)
        return d.promise
    }

    insert(objName, content) {
        let d = new Deferred()
        this.db.transaction(objName, 'readwrite').objectStore(objName).add(content)
            .onsuccess = e => d.resolve(e.target.result)
        return d.promise
    }

}

function renderCoin(value) {
    if (value)
        document.querySelector('[coin]').setAttribute('used', '');
    else
        document.querySelector('[coin]').removeAttribute('used', '');
}

let pwa = new PWA()
pwa.registerServiceWorker()

let snakeDB = null;


let snakeGame = null;


onReady(() => {

    function startPlaying(rec) {
        if (snakeGame) {
            snakeGame.playGame(rec)
            return
        }

        // Element where to render game screen
        let screen = document.querySelector('div[screen]')

        let game = new SnakeGame(screen, false, rec)

        game.onGameEnd((id) => {
            snakeDB.insert('recording', game.recording)

            setTimeout(() => {
                if (id == game.gameID && game.isDead()) {
                    snakeDB.getAllKeys('recording').then(keys => {
                        let key = Math.floor(Math.random() * 100) % keys.length
                        snakeDB.get('recording', keys[key]).then(rec => startPlaying(rec))
                    })
                }
            }, 5000);
        })
    
        // Bind keyboard arrows
        document.addEventListener('keydown', (event) => {
            game.clicked(event.key)
        })
    
        // Bind restart when clicking on coin
        document.querySelector('[coin]').addEventListener('click', e => {
            e.preventDefault()
            renderCoin(true)
            setTimeout(() => {
                if (game.isDead() || game.isPlaying) {
                    game.newGame(screen)
                    game.start()
                }
            }, 1300);
        })
    
        // Store status html elements
        game.setScoreElement(document.querySelector('div[score]'))
        game.setLevelElement(document.querySelector('div[level]'))
        game.setApplesElement(document.querySelector('div[apples]'))
    
        bindButtons(game)

        game.addChangeListener(() => {
            renderPlaying(game.isPlaying)
            renderCoin(!game.isPlaying)
        })

        snakeGame = game
    }

    (new SnakeDB(3))
        .ready.then(sdb => {
            snakeDB = sdb
            snakeDB.getAllKeys('recording').then(recordings => {
                if (recordings.length == 0) {
                    fetchURL('./recording.json').then(recordingData => {
                        startPlaying(JSON.parse(recordingData));
                        snakeDB.insert('recording', JSON.parse(recordingData))
                    }).catch(e => console.log(e))
                } else {
                    let key = Math.floor(Math.random() * 100) % recordings.length
                    snakeDB.get('recording', recordings[key]).then(rec => startPlaying(rec))
                }
            })
        })

    function calculateSize() {
        var w = window.innerWidth
            || document.documentElement.clientWidth
            || document.body.clientWidth;

        var h = window.innerHeight
            || document.documentElement.clientHeight
            || document.body.clientHeight;

        let size = getComputedStyle(document.querySelector(':root')).getPropertyValue('--size'),
            maxSize = getComputedStyle(document.querySelector(':root')).getPropertyValue('--max-size')

        size = w < h - 240 ? w - 3 : h - 244;

        if (window.gameScreenSize != size) {
            window.gameScreenSize = size;
            window.document.querySelector('body').style.setProperty('--size', '' + size + 'px');
        }
    }

    calculateSize()

    window.onresize = calculateSize;

});