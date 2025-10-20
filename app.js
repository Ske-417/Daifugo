// 大富豪プロトタイプ（スートをCSSで表現、ジョーカーをワイルドに、CPUの場流し修正）
// 使い方: index.htmlをブラウザで開いて設定をして「ゲーム開始」を押す

// --- ユーティリティ / 定義 ---
const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
// スートは内部的に識別子で扱い、描画はCSSで行う
const SUITS = ['club','diamond','heart','spade'];
const JOKER = 'JOKER';

function makeDeck(useJoker=false){
  const deck = [];
  for(const r of RANKS){
    for(const s of SUITS){
      deck.push({rank:r, suit:s, code: `${r}_${s}`});
    }
  }
  if(useJoker){
    deck.push({rank:JOKER, suit:'joker', code:'JOKER1'});
    deck.push({rank:JOKER, suit:'joker', code:'JOKER2'});
  }
  return deck;
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } }

// ランクを数値化（3が最小）
function rankValue(card){
  if(card.rank === JOKER) return 100;
  return RANKS.indexOf(card.rank);
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
clearBtn.addEventListener('click', ()=> clearPile()); // 手動クリア（通常はleaderが次手）

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
  if(card.rank === JOKER){
    el.classList.add('joker');
  } else if(card.suit === 'heart' || card.suit === 'diamond'){
    el.classList.add('red');
  }
  // ランク
  const rank = document.createElement('div');
  rank.className = 'rank';
  rank.textContent = card.rank === JOKER ? 'JOKER' : card.rank;
  // スート（表示はCSSの ::before で行う）
  const suit = document.createElement('div');
  suit.className = 'suit ' + (card.suit || '');
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
  if(!combo){ alert('その組み合わせは認識できません（単発/ペア/トリプル/4枚/階段(設定)、ジョーカー補完を含む）。'); return; }
  if(!isValidAgainstPile(combo)){
    alert('場に対して合法な出し方ではありません。');
    return;
  }
  // 出す（選んだカードを削除）
  for(const i of selIdx) human.hand.splice(i,1);
  pile.cards = playCards.slice();
  pile.combo = combo;
  pile.leader = currentPlayer;
  passCount = 0;

  // 8切り判定（シンプル版：シングルで8を出したら場クリア）
  if(settings.allow8cut && combo.type === 'single' && playCards.length===1 && playCards[0].rank === '8'){
    log(`${human.name}が8を出して場を流しました！`);
    clearPile(currentPlayer); // humanが次手のリーダー
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

// clearPile: newLeader を指定すればそのプレイヤーが次の先手になる。
// 省略時は場の leader を次先手とする（nullなら currentPlayer を維持）
function clearPile(newLeader = null){
  const oldLeader = pile.leader;
  pile = {combo:null, cards:[], leader:null};
  passCount = 0;
  if(newLeader !== null){
    currentPlayer = newLeader % players.length;
  } else if(oldLeader !== null){
    currentPlayer = oldLeader % players.length;
  }
  renderAll();
  log('場を流しました。（リセット）');
  updateTurnInfo();
  // もし次手がCPUなら自動で続行
  if(!players[currentPlayer].isHuman){
    setTimeout(nextTurnIfCPU, 300);
  }
}

// --- コンボ判定（ジョーカーをワイルドとして扱う簡易実装） ---
function detectCombo(cards, allowSequences=false){
  if(cards.length === 0) return null;
  const jokers = cards.filter(c=>c.rank === JOKER);
  const nonJ = cards.filter(c=>c.rank !== JOKER);
  const nonRanks = nonJ.map(c => c.rank);
  const uniqueNonRanks = [...new Set(nonRanks)];

  // 単発
  if(cards.length === 1) return {type:'single', rankValue: rankValue(cards[0]), rankText:cards[0].rank, length:1};

  // ペア/トリプル/フォー（ジョーカーで補完可能）
  if(nonJ.length === 0){
    // 全ジョーカー: その枚数に応じたセットとする（簡易）
    const type = cards.length === 2 ? 'pair' : (cards.length === 3 ? 'triple' : (cards.length === 4 ? 'four' : null));
    if(type) return {type, rankValue: 100, rankText: 'JOKER', length: cards.length};
  }
  if(uniqueNonRanks.length === 1){
    const baseRank = uniqueNonRanks[0];
    const totalCount = cards.length;
    const type = totalCount === 2 ? 'pair' : (totalCount === 3 ? 'triple' : (totalCount === 4 ? 'four' : null));
    if(type) return {type, rankValue: RANKS.indexOf(baseRank), rankText: baseRank, length: totalCount};
    // それ以上は不明扱い
  }

  // 階段（ワイルドでギャップを埋める）: 非ジョーカーだけで重複なし
  if(allowSequences && cards.length >= 3){
    // 非ジョーカーに重複ランクがあればシーケンス不可
    const valsNonJ = nonJ.map(c=>RANKS.indexOf(c.rank)).sort((a,b)=>a-b);
    if(valsNonJ.length !== [...new Set(valsNonJ)].length) return null; // 同じランクが複数あると厳格に不可（簡易）
    // 総長 = cards.length. 目標は、ある連続区間に対して欠けた個数が jokers.length 以下 で埋まるか
    // 試行: 各 possible start value s で s .. s+len-1 がレンジになるかチェック
    const len = cards.length;
    for(let s=0;s+len-1 < RANKS.length; s++){
      let needJ = 0;
      let ok = true;
      for(let r=s; r<=s+len-1; r++){
        if(!valsNonJ.includes(r)){
          needJ++;
        }
      }
      // もし nonJ に含まれる値が範囲外なら invalid
      for(const v of valsNonJ){
        if(v < s || v > s+len-1) { ok=false; break; }
      }
      if(!ok) continue;
      if(needJ <= jokers.length){
        // 成立。rankValue はシーケンス最後のランク値（強さ判定用）
        return {type:'sequence', length: len, rankValue: s+len-1, rankText:`${RANKS[s]}〜`, length: len};
      }
    }
  }

  return null;
}

// --- 場に対して有効か ---
function isValidAgainstPile(combo){
  if(!pile.combo) return true;
  if(combo.type === pile.combo.type){
    if(combo.type === 'sequence' && combo.length !== pile.combo.length) return false;
    const rev = revolution;
    if(rev){
      return combo.rankValue < pile.combo.rankValue;
    } else {
      return combo.rankValue > pile.combo.rankValue;
    }
  }
  return false;
}

// --- CPU処理（ジョーカー対応の簡易ヒューリスティック） ---
function nextTurnIfCPU(){
  if(players[currentPlayer].isHuman) return;
  const cpu = players[currentPlayer];
  const play = cpuChoosePlay(cpu);
  if(!play){
    log(`${cpu.name} はパスしました。`);
    passCount++;
    // パスが全員（リーダー以外）なら場クリア
    if(pile.leader !== null && passCount >= players.length - 1){
      log('全員パスしたため場が流れます。');
      // 次の先手は現在の場の leader
      clearPile(/* newLeader omitted -> uses old leader */);
    } else {
      currentPlayer = (currentPlayer + 1) % players.length;
      renderAll();
      updateTurnInfo();
      setTimeout(nextTurnIfCPU, 400);
    }
    return;
  }

  // 出す
  for(const c of play.cards){
    const idx = cpu.hand.findIndex(h => h === c || (h.rank === c.rank && h.suit === c.suit && h.code === c.code));
    if(idx>=0) cpu.hand.splice(idx,1);
  }
  pile.cards = play.cards.slice();
  pile.combo = play.combo;
  pile.leader = currentPlayer;
  passCount = 0;
  log(`${cpu.name} が ${play.combo.type} を出しました。`);

  // 8切り判定（CPUも適用）
  if(settings.allow8cut && play.combo.type === 'single' && play.cards.length === 1 && play.cards[0].rank === '8'){
    log(`${cpu.name}が8を出して場を流しました！`);
    // clearPile で次の先手をこのCPUにする
    clearPile(currentPlayer);
    return; // ここで戻して currentPlayer を変更済みにする
  }

  // 革命判定
  if(settings.allowRevolution && play.combo.type === 'four'){
    revolution = !revolution;
    log(`革命が起きました（${revolution ? '革命中' : '通常'}）`);
  }

  // 上がりチェック
  if(cpu.hand.length === 0){
    cpu.finishedRank = true;
    log(`${cpu.name} が上がりました！`);
    // 続きは簡易: ゲームは続行（順位付けやラウンド終了は後で拡張可）
  }

  currentPlayer = (currentPlayer + 1) % players.length;
  renderAll();
  updateTurnInfo();
  setTimeout(nextTurnIfCPU, 400);
}

// CPUが手を選ぶ（ジョーカーを使って候補生成）
function cpuChoosePlay(cpu){
  if(!pile.combo){
    // リード: 優先 ペア > シングル
    // まずペア以上をジョーカー含めて探す
    const grouped = groupByRank(cpu.hand);
    const jokers = cpu.hand.filter(c=>c.rank===JOKER);
    // ペア以上探す（need=2..4）
    for(const need of [2,3,4]){
      // 選べるランクを探す（実カード+ジョーカーで満たせるもの）
      for(const r of RANKS){
        const cards = buildSetWithJokers(cpu.hand, need, r);
        if(cards) return {cards, combo: detectCombo(cards, settings.allowSequences)};
      }
      // ジョーカーのみで揃える可能性
      if(jokers.length >= need){
        const cards = jokers.slice(0,need);
        return {cards, combo: detectCombo(cards, settings.allowSequences)};
      }
    }
    // なければ最小単発
    const single = cpu.hand.reduce((a,b)=> rankValue(a) <= rankValue(b) ? a : b);
    return {cards:[single], combo: detectCombo([single], settings.allowSequences)};
  } else {
    // 場がある: 同型で上回る手を探す（ジョーカーを利用）
    const needType = pile.combo.type;
    if(needType === 'single'){
      // 単発: 単発候補を作る（含ジョーカー）
      const candidates = findSameTypeCandidates(cpu.hand, 'single', 1);
      const winning = candidates.filter(c=>{
        const comb = detectCombo(c, settings.allowSequences);
        if(!comb) return false;
        if(revolution) return comb.rankValue < pile.combo.rankValue;
        else return comb.rankValue > pile.combo.rankValue;
      });
      if(winning.length === 0) return null;
      winning.sort((a,b)=> detectCombo(a, settings.allowSequences).rankValue - detectCombo(b, settings.allowSequences).rankValue);
      return {cards: winning[0], combo: detectCombo(winning[0], settings.allowSequences)};
    } else if(needType === 'pair' || needType === 'triple' || needType === 'four'){
      const need = needType === 'pair' ? 2 : (needType === 'triple' ? 3 : 4);
      // try by rank with jokers
      const candidates = [];
      for(const r of RANKS){
        const cards = buildSetWithJokers(cpu.hand, need, r);
        if(cards){
          const comb = detectCombo(cards, settings.allowSequences);
          if(!comb) continue;
          if(revolution ? comb.rankValue < pile.combo.rankValue : comb.rankValue > pile.combo.rankValue){
            candidates.push(cards);
          }
        }
      }
      // jokers-only candidate
      const jokers = cpu.hand.filter(c=>c.rank===JOKER);
      if(jokers.length >= need){
        const cards = jokers.slice(0,need);
        const comb = detectCombo(cards, settings.allowSequences);
        if(comb && (revolution ? comb.rankValue < pile.combo.rankValue : comb.rankValue > pile.combo.rankValue)){
          candidates.push(cards);
        }
      }
      if(candidates.length === 0) return null;
      candidates.sort((a,b)=> detectCombo(a, settings.allowSequences).rankValue - detectCombo(b, settings.allowSequences).rankValue);
      return {cards: candidates[0], combo: detectCombo(candidates[0], settings.allowSequences)};
    } else if(needType === 'sequence' && settings.allowSequences){
      const seqLen = pile.combo.length;
      const candidates = findSameTypeCandidates(cpu.hand, 'sequence', seqLen);
      const winning = candidates.filter(c=>{
        const comb = detectCombo(c, settings.allowSequences);
        if(!comb) return false;
        if(revolution) return comb.rankValue < pile.combo.rankValue;
        else return comb.rankValue > pile.combo.rankValue;
      });
      if(winning.length === 0) return null;
      winning.sort((a,b)=> detectCombo(a, settings.allowSequences).rankValue - detectCombo(b, settings.allowSequences).rankValue);
      return {cards: winning[0], combo: detectCombo(winning[0], settings.allowSequences)};
    }
    return null;
  }
}

// groupByRank（ジョーカーは別扱い）
function groupByRank(hand){
  const g = {};
  for(const c of hand){
    if(c.rank === JOKER) continue;
    g[c.rank] = g[c.rank] || [];
    g[c.rank].push(c);
  }
  return g;
}

// buildSetWithJokers: hand から targetRank のセットを need 枚作れるなら配列を返す（ジョーカーで補完）
// 例: need=3, targetRank='5' で 5, JOKER を使って [5, JOKER, JOKER] などを返す
function buildSetWithJokers(hand, need, targetRank){
  const real = hand.filter(c=>c.rank === targetRank);
  const jokers = hand.filter(c=>c.rank === JOKER);
  const have = real.length;
  if(have + jokers.length < need) return null;
  const res = [];
  // まず実カードを詰める
  for(let i=0;i<Math.min(have, need); i++) res.push(real[i]);
  // 足りなければジョーカーを詰める
  let rem = need - res.length;
  for(let j=0;j<rem; j++) res.push(jokers[j]);
  return res;
}

// findSameTypeCandidates 拡張: ジョーカーを考慮して候補を作る（sequence は専用ロジック）
function findSameTypeCandidates(hand, type, seqLength){
  const res = [];
  const jokers = hand.filter(c=>c.rank===JOKER);
  if(type === 'single'){
    for(const c of hand) res.push([c]);
  } else if(type === 'pair' || type === 'triple' || type === 'four'){
    const need = type === 'pair' ? 2 : (type === 'triple' ? 3 : 4);
    // 実カード + ジョーカーで満たせるランクをすべて作る
    for(const r of RANKS){
      const candidate = buildSetWithJokers(hand, need, r);
      if(candidate) res.push(candidate);
    }
    // ジョーカーのみで作るパターン（既にカバーされている可能性もある）
    if(jokers.length >= need){
      res.push(jokers.slice(0,need));
    }
  } else if(type === 'sequence' && settings.allowSequences){
    // シーケンス探索：開始位置 s をスライドして、そのレンジを hand 内の実カード+ジョーカーで満たせるか確認
    const len = seqLength;
    // make map rank -> list
    const rankMap = {};
    for(const c of hand){
      if(c.rank === JOKER) continue;
      rankMap[c.rank] = rankMap[c.rank] || [];
      rankMap[c.rank].push(c);
    }
    for(let s=0; s+len-1 < RANKS.length; s++){
      let needJ = 0;
      const chosen = [];
      const usedRanks = {};
      for(let r=s; r<=s+len-1; r++){
        const rankName = RANKS[r];
        if(rankMap[rankName] && rankMap[rankName].length > (usedRanks[rankName] || 0)){
          // take one card of that rank
          chosen.push(rankMap[rankName][usedRanks[rankName] || 0]);
          usedRanks[rankName] = (usedRanks[rankName] || 0) + 1;
        } else {
          needJ++;
        }
      }
      if(needJ <= jokers.length){
        // fill with needed jokers
        const usedJokers = jokers.slice(0, needJ);
        res.push(chosen.concat(usedJokers));
      }
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
