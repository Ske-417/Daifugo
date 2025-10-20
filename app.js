// 大富豪プロトタイプ（軽いヒューリスティックAI）
// 使い方: index.htmlをブラウザで開いて設定をして「ゲーム開始」を押す

// --- ユーティリティ / 定義 ---
const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const SUITS = ['♣','♦','♥','♠']; // 表示用（画像があれば置き換え）
const JOKER = 'JOKER';

function makeDeck(useJoker=false){
  const deck = [];
  for(const r of RANKS){
    for(const s of SUITS){
      deck.push({rank:r, suit:s, code: `${r}${s}`});
    }
  }
  if(useJoker){
    deck.push({rank:JOKER, suit:'', code:'JOKER1'});
    deck.push({rank:JOKER, suit:'', code:'JOKER2'});
  }
  return deck;
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } }

// ランクを数値化（3が最小）
function rankValue(card){
  if(card.rank === JOKER) return 100;
  return RANKS.indexOf(card.rank);
}

// 比較（革命時フリップ）
function compareRanks(a,b,revolution=false){
  const av = rankValue(a), bv = rankValue(b);
  if(revolution) return bv - av;
  return av - bv;
}

// --- DOM ---
const cpuCountSel = document.getElementById('cpuCount');
const startBtn = document.getElementById('startBtn');
const handDiv = document.getElementById('hand');
const playBtn = document.getElementById('playBtn');
const passBtn = document.getElementById('passBtn');
const clearBtn = document.getElementById('clearBtn');
const playersArea = document.getElementById('playersArea');
const pileDiv = document.getElementById('pile');
const turnInfo = document.getElementById('turnInfo');
const pileText = document.getElementById('pileText');
const logDiv = document.getElementById('log');
const selectedCount = document.getElementById('selectedCount');

const optRevolution = document.getElementById('optRevolution');
const opt8cut = document.getElementById('opt8cut');
const optSequences = document.getElementById('optSequences');
const optJoker = document.getElementById('optJoker');

// --- ゲーム状態 ---
let players = []; // {id,name,isHuman,hand:[] , finishedRank: null}
let pile = { combo: null, cards: [], leader: null }; // combo = {type:'single'|'pair'|'triple'|'four'|'sequence', rankValue: x, length: n}
let currentPlayer = 0;
let passCount = 0;
let revolution = false;
let settings = { useJoker:false, allow8cut:true, allowSequences:true, allowRevolution:true };

// --- イベント ---
startBtn.addEventListener('click', startGame);
playBtn.addEventListener('click', humanPlay);
passBtn.addEventListener('click', humanPass);
clearBtn.addEventListener('click', clearPile);

function log(s){
  const p = document.createElement('div'); p.textContent = s;
  logDiv.appendChild(p);
  logDiv.scrollTop = logDiv.scrollHeight;
}

// --- ゲーム開始 ---
function startGame(){
  settings.useJoker = optJoker.checked;
  settings.allow8cut = opt8cut.checked;
  settings.allowSequences = optSequences.checked;
  settings.allowRevolution = optRevolution.checked;

  const cpuCount = parseInt(cpuCountSel.value,10);
  const totalPlayers = 1 + cpuCount;
  const deck = makeDeck(settings.useJoker);
  shuffle(deck);

  players = [];
  for(let i=0;i<totalPlayers;i++){
    players.push({id:i, name: i===0 ? 'あなた' : `CPU ${i}`, isHuman: i===0, hand: [], finishedRank:null});
  }
  // 配り
  for(let i=0;i<deck.length;i++){
    const p = i % totalPlayers;
    players[p].hand.push(deck[i]);
  }
  // ソート（手札はランクソート）
  for(const pl of players){
    pl.hand.sort((a,b)=> rankValue(a) - rankValue(b));
  }

  pile = { combo:null, cards: [], leader:null };
  currentPlayer = 0; // あなたから
  passCount = 0;
  revolution = false;

  renderAll();
  log('ゲーム開始。あなたからです。');
  updateTurnInfo();
}

// --- 描画 ---
function renderAll(){
  renderPlayers();
  renderHand();
  renderPile();
}

function renderPlayers(){
  playersArea.innerHTML = '';
  players.forEach((p,idx)=>{
    const div = document.createElement('div');
    div.className = 'player';
    div.innerHTML = `<div>${p.name} ${p.finishedRank ? '(上がり)' : ''}</div><div>残り:${p.hand.length}</div>`;
    playersArea.appendChild(div);
  });
}

function renderHand(){
  handDiv.innerHTML = '';
  const human = players[0];
  human.hand.forEach((c,i)=>{
    const cardEl = createCardElement(c);
    cardEl.dataset.index = i;
    cardEl.addEventListener('click', ()=> toggleSelect(cardEl));
    handDiv.appendChild(cardEl);
  });
  updateSelectedCount();
}

function renderPile(){
  pileDiv.innerHTML = '';
  if(pile.cards.length === 0){
    pileText.textContent = 'なし';
    return;
  }
  pileText.textContent = `${pile.combo ? pile.combo.type : '不明'} — ${pile.combo ? pile.combo.rankText || '' : ''}`;
  for(const c of pile.cards){
    pileDiv.appendChild(createCardElement(c));
  }
}

function createCardElement(card){
  const el = document.createElement('div');
  el.className = 'card';
  // 画像があれば images/cards/{code}.png などで探す（利用者が置く想定）
  // ここではテキストが表示される
  const rank = document.createElement('div');
  rank.className = 'rank';
  rank.textContent = card.rank === JOKER ? 'JOKER' : card.rank;
  const suit = document.createElement('div');
  suit.className = 'suit';
  suit.textContent = card.suit;
  el.appendChild(rank);
  el.appendChild(suit);
  return el;
}

function toggleSelect(el){
  el.classList.toggle('selected');
  updateSelectedCount();
}
function getSelectedIndices(){
  const selected = Array.from(handDiv.querySelectorAll('.card.selected'));
  return selected.map(s => parseInt(s.dataset.index,10)).sort((a,b)=>b-a); // 降順で返す（抜くときのindexずれ対策）
}
function updateSelectedCount(){
  const cnt = handDiv.querySelectorAll('.card.selected').length;
  selectedCount.textContent = `選択：${cnt}`;
}

// --- 人間の操作 ---
function humanPlay(){
  const selIdx = getSelectedIndices();
  if(selIdx.length===0){ alert('カードを選択してください'); return; }
  const human = players[0];
  const playCards = selIdx.map(i => human.hand[i]);
  // 合法手かチェック
  const combo = detectCombo(playCards, settings.allowSequences);
  if(!combo){ alert('その組み合わせは認識できません（単発/ペア/トリプル/4枚/階段(設定)）。'); return; }
  if(!isValidAgainstPile(combo)){
    alert('場に対して合法な出し方ではありません。');
    return;
  }
  // 出す
  for(const i of selIdx) human.hand.splice(i,1);
  pile.cards = playCards.slice();
  pile.combo = combo;
  pile.leader = currentPlayer;
  passCount = 0;

  // 8切り判定（シンプル版：シングルで8を出したら場クリア）
  if(settings.allow8cut && combo.type === 'single' && playCards.length===1 && playCards[0].rank === '8'){
    log(`${human.name}が8を出して場を流しました！`);
    clearPile();
  } else {
    log(`${human.name} が ${combo.type} を出しました。`);
    // 革命判定
    if(settings.allowRevolution && combo.type === 'four'){
      revolution = !revolution;
      log(`革命が起きました！ 強さが逆転します（現在: ${revolution ? '革命中' : '通常'}）`);
    }
    currentPlayer = (currentPlayer + 1) % players.length;
    renderAll();
    updateTurnInfo();
    // 次がCPUなら自動で処理
    setTimeout(nextTurnIfCPU, 300);
  }
}

function humanPass(){
  log('あなたはパスしました。');
  passCount++;
  currentPlayer = (currentPlayer + 1) % players.length;
  renderAll();
  updateTurnInfo();
  setTimeout(nextTurnIfCPU, 300);
}

function clearPile(){
  pile = {combo:null, cards:[], leader:null};
  passCount = 0;
  renderAll();
  log('場を流しました。（リセット）');
}

// --- コンボ判定（簡易） ---
function detectCombo(cards, allowSequences=false){
  // cards: array of card objects
  if(cards.length === 0) return null;
  // ジョーカー注意（簡易ではジョーカーは単発/ペア/トリプルにのみ対応。複雑なワイルド扱いは未実装）
  const ranks = cards.map(c => c.rank);
  const uniqueRanks = [...new Set(ranks)];
  if(cards.length === 1) return {type:'single', rankValue: rankValue(cards[0]), rankText:cards[0].rank};
  // ペア/トリプル/フォー
  if(uniqueRanks.length === 1){
    const type = cards.length === 2 ? 'pair' : (cards.length === 3 ? 'triple' : (cards.length === 4 ? 'four' : null));
    if(type) return {type, rankValue: rankValue(cards[0]), rankText: cards[0].rank};
  }
  // 階段（連番） - 簡易: 同じスートかどうかはチェックしない（設定で有効化）
  if(allowSequences && cards.length >= 3){
    // ジョーカー混入は未対応
    if(cards.some(c=>c.rank===JOKER)) return null;
    // ソートして連続か判定
    const vals = cards.map(c => rankValue(c)).sort((a,b)=>a-b);
    let consecutive = true;
    for(let i=1;i<vals.length;i++){
      if(vals[i] !== vals[i-1] + 1) { consecutive = false; break; }
    }
    if(consecutive) return {type:'sequence', length:cards.length, rankValue: vals[vals.length-1], rankText: `${cards[0].rank}〜`};
  }
  return null;
}

// --- 場に対して有効か ---
function isValidAgainstPile(combo){
  if(!pile.combo) return true; // リードならOK
  // 型が同じで長さも同じ、かつ強ければOK（革命を反映）
  if(combo.type === pile.combo.type){
    // シーケンスは長さも合わせる
    if(combo.type === 'sequence' && combo.length !== pile.combo.length) return false;
    // 単純比較（rankValueが大きければ強い。革命中は反転）
    const rev = revolution;
    if(rev){
      return combo.rankValue < pile.combo.rankValue;
    } else {
      return combo.rankValue > pile.combo.rankValue;
    }
  }
  // ただし、4枚革命ルール: 4枚を出すことで革命（場と同じ型でなくても）-- 実際のルールによるが、ここでは4枚は4枚で比較する必要あり
  return false;
}

// --- CPU処理（簡易ヒューリスティック） ---
function nextTurnIfCPU(){
  if(players[currentPlayer].isHuman) return;
  const cpu = players[currentPlayer];
  // AI: 場がないなら最小の単発（もしくはペア）を出す。
  // 場があるなら最小で上回る手を探す。無ければパス。
  const play = cpuChoosePlay(cpu);
  if(!play){
    log(`${cpu.name} はパスしました。`);
    passCount++;
    // パスが全員（リーダー以外）なら場クリア
    if(pile.leader !== null && passCount >= players.length - 1){
      // 場クリア
      log('全員パスしたため場が流れます。');
      clearPile();
    } else {
      currentPlayer = (currentPlayer + 1) % players.length;
      renderAll();
      updateTurnInfo();
      setTimeout(nextTurnIfCPU, 400);
    }
    return;
  }
  // 出す
  // remove cards from cpu.hand (matching by object reference)
  for(const c of play.cards){
    const idx = cpu.hand.findIndex(h => h === c || (h.rank === c.rank && h.suit === c.suit && h.code === c.code));
    if(idx>=0) cpu.hand.splice(idx,1);
  }
  pile.cards = play.cards.slice();
  pile.combo = play.combo;
  pile.leader = currentPlayer;
  passCount = 0;
  log(`${cpu.name} が ${play.combo.type} を出しました。`);
  if(settings.allowRevolution && play.combo.type === 'four'){
    revolution = !revolution;
    log(`革命が起きました（${revolution ? '革命中' : '通常'}）`);
  }

  // 上がりチェック
  if(cpu.hand.length === 0){
    cpu.finishedRank = true;
    log(`${cpu.name} が上がりました！`);
    // 終了判定は簡易化（1人でも上がれば終了とするか順位付けは今後拡張）
    const humanStillHas = players[0].hand.length > 0;
    if(!humanStillHas){
      log('ゲーム終了');
      renderAll();
      return;
    }
  }

  currentPlayer = (currentPlayer + 1) % players.length;
  renderAll();
  updateTurnInfo();
  setTimeout(nextTurnIfCPU, 400);
}

function cpuChoosePlay(cpu){
  // 場がない -> リード: 優先度: 1) 最小のペア(あれば) 2) 最小の単発
  if(!pile.combo){
    // try pair/triple first to be少し賢く
    const grouped = groupByRank(cpu.hand);
    for(const r in grouped){
      if(grouped[r].length >= 2){ // ペア優先
        const cards = grouped[r].slice(0,2);
        return {cards, combo: detectCombo(cards, settings.allowSequences)};
      }
    }
    // ないなら最小単発
    const single = cpu.hand.reduce((a,b)=> rankValue(a) <= rankValue(b) ? a : b);
    return {cards:[single], combo: detectCombo([single], settings.allowSequences)};
  } else {
    // 場がある -> 最小で上回る手を探す
    // 提示：現在は同種のみで比較（例: 場がペアならペアで応える）
    const needType = pile.combo.type;
    const candidates = findSameTypeCandidates(cpu.hand, needType, pile.combo.length);
    // filter by strength
    const winning = candidates.filter(c=>{
      const comb = detectCombo(c, settings.allowSequences);
      if(!comb) return false;
      // compare rankValue taking revolution into account
      if(revolution) return comb.rankValue < pile.combo.rankValue;
      else return comb.rankValue > pile.combo.rankValue;
    });
    if(winning.length === 0) return null;
    // choose smallest winning (min rankValue)
    winning.sort((a,b)=>{
      const ra = detectCombo(a, settings.allowSequences).rankValue;
      const rb = detectCombo(b, settings.allowSequences).rankValue;
      return ra - rb;
    });
    const chosen = winning[0];
    return {cards:chosen, combo: detectCombo(chosen, settings.allowSequences)};
  }
}

function groupByRank(hand){
  const g = {};
  for(const c of hand){
    g[c.rank] = g[c.rank] || [];
    g[c.rank].push(c);
  }
  return g;
}

function findSameTypeCandidates(hand, type, seqLength){
  const res = [];
  if(type === 'single'){
    for(const c of hand) res.push([c]);
  } else if(type === 'pair' || type === 'triple' || type === 'four'){
    const need = type === 'pair' ? 2 : (type === 'triple' ? 3 : 4);
    const g = groupByRank(hand);
    for(const r in g){
      if(g[r].length >= need){
        res.push(g[r].slice(0,need));
      }
    }
  } else if(type === 'sequence' && settings.allowSequences){
    // シンプルなシーケンス検索: sort by rankValue, sliding window
    const arr = hand.slice().filter(c=>c.rank !== JOKER).sort((a,b)=>rankValue(a)-rankValue(b));
    for(let i=0;i+seqLength-1 < arr.length;i++){
      const slice = arr.slice(i,i+seqLength);
      // check consecutive
      let ok = true;
      for(let j=1;j<slice.length;j++){
        if(rankValue(slice[j]) !== rankValue(slice[j-1]) + 1){ ok = false; break; }
      }
      if(ok) res.push(slice);
    }
  }
  return res;
}

// --- ターン情報表示 ---
function updateTurnInfo(){
  turnInfo.textContent = `ターン: ${players[currentPlayer].name} の番  ${revolution ? '(革命中)' : ''}`;
  renderPlayers();
  renderPile();
}

// 初期メッセージ
log('プロトタイプを読み込みました。設定を選んで「ゲーム開始」を押してください。');
