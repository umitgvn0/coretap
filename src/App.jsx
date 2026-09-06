import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const tg = window.Telegram?.WebApp;
  const telegramId = tg?.initDataUnsafe?.user?.id || 999999; 
  
  // Telegram'dan gelen gerçek isim ve kullanıcı adını alıyoruz
  const firstName = tg?.initDataUnsafe?.user?.first_name || (telegramId === 6892178102 ? 'Ümit' : 'Muhammet');
  const username = tg?.initDataUnsafe?.user?.username || firstName;

  const [points, setPoints] = useState(0);
  const [energy, setEnergy] = useState(100);
  const [maxEnergy, setMaxEnergy] = useState(100);
  const [tapPower, setTapPower] = useState(1);
  const [hasAutobot, setHasAutobot] = useState(false);
  
  const [lastClickTime, setLastClickTime] = useState(0);
  const CLICK_COOLDOWN = 150; 

  const [activeTab, setActiveTab] = useState('game');
  const [showDailyModal, setShowDailyModal] = useState(false); 
  const [streakDay, setStreakDay] = useState(1);
  const [claimedToday, setClaimedToday] = useState(false);

  // Klan State'leri
  const [squadNameInput, setSquadNameInput] = useState('');
  const [mySquad, setMySquad] = useState(null);
  const [squadsList, setSquadsList] = useState([]);
  const [squadMembers, setSquadMembers] = useState([]);

  // Görevler State'i
  const [twitterCompleted, setTwitterCompleted] = useState(false);

  const dailyRewards = [
    { day: 1, reward: 10 },
    { day: 2, reward: 15 },
    { day: 3, reward: 25 },
    { day: 4, reward: 40 },
    { day: 5, reward: 60 },
    { day: 6, reward: 90 },
    { day: 7, reward: 150 },
  ];

  const getCurrentLeague = (pts) => {
    if (pts >= 500000) return { name: 'Core King 👑', color: 'text-yellow-300' };
    if (pts >= 250000) return { name: 'Grandmaster ⚡', color: 'text-purple-400' };
    if (pts >= 100000) return { name: 'Master 🔮', color: 'text-indigo-400' };
    if (pts >= 50000)  return { name: 'Elmas 💎', color: 'text-cyan-300' };
    if (pts >= 25000)  return { name: 'Platin 🛡️', color: 'text-blue-400' };
    if (pts >= 10000)  return { name: 'Altın 🥇', color: 'text-yellow-400' };
    if (pts >= 5000)   return { name: 'Gümüş 🥈', color: 'text-slate-300' };
    return { name: 'Bronz 🥉', color: 'text-amber-600' };
  };

  const currentLeague = getCurrentLeague(points);

  const getTodayDateString = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    async function fetchUserData() {
      let { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId);

      const todayStr = getTodayDateString();

      if (error || !data || data.length === 0) {
        let { data: newData, error: insertError } = await supabase
          .from('users')
          .insert([{ 
            telegram_id: telegramId, 
            username: username, 
            points: 0, 
            energy: 100, 
            tap_power: 1,
            streak: 1,
            last_claim_date: '',
            has_autobot: false,
            squad_id: null,
            twitter_completed: false
          }])
          .select();

        if (!insertError && newData && newData.length > 0) {
          const user = newData[0];
          setPoints(user.points);
          setEnergy(user.energy);
          setTapPower(user.tap_power);
          setStreakDay(user.streak || 1);
          setClaimedToday(user.last_claim_date === todayStr);
          setHasAutobot(user.has_autobot || false);
          setTwitterCompleted(user.twitter_completed || false);
          if (user.squad_id) fetchSquadDetails(user.squad_id);
        }
      } else {
        const user = data[0];
        setPoints(user.points);
        setEnergy(user.energy);
        setTapPower(user.tap_power);
        setStreakDay(user.streak || 1);
        setClaimedToday(user.last_claim_date === todayStr);
        setHasAutobot(user.has_autobot || false);
        setTwitterCompleted(user.twitter_completed || false);
        
        // Eğer veritabanındaki kullanıcı adı eskiden kalma "Ümit" ise ve yeni hesap farklıysa güncelleyelim
        if (user.username !== username) {
          await supabase
            .from('users')
            .update({ username: username })
            .eq('telegram_id', telegramId);
        }

        if (user.squad_id) fetchSquadDetails(user.squad_id);
      }
      
      fetchSquadsList();
    }

    fetchUserData();
  }, [telegramId, username]);

  const fetchSquadsList = async () => {
    let { data, error } = await supabase
      .from('squads')
      .select('*')
      .order('total_score', { ascending: false });

    if (!error && data) {
      setSquadsList(data);
    }
  };

  const fetchSquadDetails = async (squadId) => {
    let { data: squadData, error } = await supabase
      .from('squads')
      .select('*')
      .eq('id', squadId)
      .single();

    if (!error && squadData) {
      setMySquad(squadData);
      let { data: membersData } = await supabase
        .from('users')
        .select('*')
        .eq('squad_id', squadId);
      
      if (membersData) setSquadMembers(membersData);
    }
  };

  const syncWithSupabase = async (newPoints, newEnergy, autobotStatus = hasAutobot) => {
    await supabase
      .from('users')
      .update({ points: newPoints, energy: newEnergy, has_autobot: autobotStatus })
      .eq('telegram_id', telegramId);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setEnergy((prev) => (prev < maxEnergy ? prev + 1 : maxEnergy));
    }, 2000);
    return () => clearInterval(timer);
  }, [maxEnergy]);

  useEffect(() => {
    if (!hasAutobot) return;
    const autoBotTimer = setInterval(() => {
      setPoints((prevPoints) => prevPoints + 5);
    }, 3000);
    return () => clearInterval(autoBotTimer);
  }, [hasAutobot]);

  useEffect(() => {
    if (!hasAutobot) return;
    const saveInterval = setInterval(() => {
      setPoints((currentPoints) => {
        syncWithSupabase(currentPoints, energy, true);
        return currentPoints;
      });
    }, 30000);
    return () => clearInterval(saveInterval);
  }, [hasAutobot, energy]);

  const handleTap = (e) => {
    const now = Date.now();
    if (now - lastClickTime < CLICK_COOLDOWN) return;
    if (energy <= 0) return;

    setLastClickTime(now);
    const updatedPoints = points + tapPower;
    const updatedEnergy = Math.max(0, energy - 1);

    setPoints(updatedPoints);
    setEnergy(updatedEnergy);
    syncWithSupabase(updatedPoints, updatedEnergy);
    createClickEffect(e, `+${tapPower}`);
  };

  const createClickEffect = (e, text) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const elem = document.createElement('div');
    elem.className = 'absolute text-yellow-400 font-bold text-xl pointer-events-none animate-bounce';
    elem.style.left = `${x}px`;
    elem.style.top = `${y}px`;
    elem.innerText = text;
    target.appendChild(elem);

    setTimeout(() => elem.remove(), 800);
  };

  const handleCompleteTwitterQuest = async () => {
    if (twitterCompleted) return;

    window.open('https://x.com/coretapofficial', '_blank');

    const rewardAmount = 500;
    const updatedPoints = points + rewardAmount;
    
    setPoints(updatedPoints);
    setTwitterCompleted(true);

    await supabase
      .from('users')
      .update({ points: updatedPoints, twitter_completed: true })
      .eq('telegram_id', telegramId);

    if (tg?.showAlert) {
      tg.showAlert(`Tebrikler! +${rewardAmount} 💎 kazandın!`);
    }
  };

  const handleCreateSquadStars = async () => {
    if (mySquad) {
      alert("Zaten bir klandasın! Önce mevcut klandan ayrılmalısın.");
      return;
    }

    const squadName = squadNameInput.trim();
    if (!squadName) {
      alert("Lütfen bir klan adı girin!");
      return;
    }

    if (!tg || !tg.openInvoice) {
      alert("Test ortamında veya Telegram dışında ödeme yapılamaz!");
      return;
    }

    try {
      const res = await fetch('/api/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Klan Kurulumu: ${squadName}`,
          description: 'CoreTap oyununda özel klan kurma ücreti (300 Stars)',
          amount: 300,
          payload: `create_squad_${squadName}_${telegramId}`
        })
      });

      const data = await res.json();
      if (!data.invoiceLink) {
        alert("Fatura oluşturulamadı: " + (data.error || 'Bilinmeyen hata'));
        return;
      }

      tg.openInvoice(data.invoiceLink, async (status) => {
        if (status === 'paid') {
          await createSquadInDB(squadName);
        } else {
          alert("Ödeme iptal edildi veya başarısız oldu.");
        }
      });
    } catch (err) {
      alert("Ödeme başlatılamadı: " + err.message);
    }
  };

  const createSquadInDB = async (squadName) => {
    let { data, error } = await supabase
      .from('squads')
      .insert([{
        name: squadName,
        leader_telegram_id: telegramId,
        members_count: 1,
        total_score: points
      }])
      .select();

    if (error || !data) {
      alert("Klan kurulamadı: " + (error?.message || "Bilinmeyen hata"));
      return;
    }

    const newSquad = data[0];

    await supabase
      .from('users')
      .update({ squad_id: newSquad.id })
      .eq('telegram_id', telegramId);

    setMySquad(newSquad);
    setSquadNameInput('');
    fetchSquadsList();
    fetchSquadDetails(newSquad.id);
    if (tg?.showAlert) tg.showAlert(`Tebrikler! '${squadName}' klanı başarıyla kuruldu! 🛡️`);
  };

  const handleJoinSquad = async (squad) => {
    if (mySquad) {
      alert("Zaten bir klandasın!");
      return;
    }

    if (squad.members_count >= 20) {
      alert("Bu klan dolu (Maksimum 20 üye)!");
      return;
    }

    await supabase
      .from('users')
      .update({ squad_id: squad.id })
      .eq('telegram_id', telegramId);

    await supabase
      .from('squads')
      .update({ members_count: squad.members_count + 1 })
      .eq('id', squad.id);

    fetchSquadsList();
    fetchSquadDetails(squad.id);
  };

  const handleLeaveSquad = async () => {
    if (!mySquad) return;

    if (mySquad.leader_telegram_id === telegramId) {
      alert("Klan başkanı klandan ayrılamaz!");
      return;
    }

    await supabase
      .from('users')
      .update({ squad_id: null })
      .eq('telegram_id', telegramId);

    await supabase
      .from('squads')
      .update({ members_count: Math.max(1, mySquad.members_count - 1) })
      .eq('id', mySquad.id);

    setMySquad(null);
    setSquadMembers([]);
    fetchSquadsList();
  };

  const handleKickMember = async (memberTelegramId) => {
    if (mySquad.leader_telegram_id !== telegramId) return;

    await supabase
      .from('users')
      .update({ squad_id: null })
      .eq('telegram_id', memberTelegramId);

    await supabase
      .from('squads')
      .update({ members_count: Math.max(1, mySquad.members_count - 1) })
      .eq('id', mySquad.id);

    fetchSquadDetails(mySquad.id);
    fetchSquadsList();
  };

  const claimDailyReward = async (rewardAmount) => {
    if (claimedToday) return;
    const todayStr = getTodayDateString();
    const nextStreak = streakDay >= 7 ? 1 : streakDay + 1; 
    const updatedPoints = points + rewardAmount;

    setPoints(updatedPoints);
    setClaimedToday(true);
    setShowDailyModal(false);

    await supabase
      .from('users')
      .update({ points: updatedPoints, last_claim_date: todayStr, streak: nextStreak })
      .eq('telegram_id', telegramId);
  };

  const buyMultitap = () => {
    const cost = 2000 * tapPower;
    if (points < cost) { alert("Yetersiz bakiye!"); return; }
    const updatedPoints = points - cost;
    const updatedPower = tapPower + 1;
    setPoints(updatedPoints);
    setTapPower(updatedPower);
    supabase.from('users').update({ points: updatedPoints, tap_power: updatedPower }).eq('telegram_id', telegramId);
  };

  const buyEnergyTank = () => {
    const cost = 3000;
    if (points < cost) { alert("Yetersiz bakiye!"); return; }
    const updatedPoints = points - cost;
    const updatedMaxEnergy = maxEnergy + 50;
    setPoints(updatedPoints);
    setMaxEnergy(updatedMaxEnergy);
    setEnergy(updatedMaxEnergy);
    syncWithSupabase(updatedPoints, updatedMaxEnergy);
  };

  const buyTelegramStarsPackage = async (packageName, starsPrice, rewardType) => {
    if (!tg || !tg.openInvoice) {
      alert("Test ortamında veya Telegram dışında ödeme yapılamaz!");
      return;
    }

    try {
      const res = await fetch('/api/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: packageName,
          description: `CoreTap VIP Mağaza: ${packageName}`,
          amount: starsPrice,
          payload: `buy_${rewardType}_${telegramId}`
        })
      });

      const data = await res.json();
      if (!data.invoiceLink) {
        alert("Fatura oluşturulamadı: " + (data.error || 'Bilinmeyen hata'));
        return;
      }

      tg.openInvoice(data.invoiceLink, async (status) => {
        if (status === 'paid') {
          grantReward(rewardType);
          tg.showAlert(`Tebrikler! ${packageName} başarıyla etkinleştirildi! 🌟`);
        } else {
          alert("Ödeme iptal edildi.");
        }
      });
    } catch (err) {
      alert("Ödeme başlatılamadı: " + err.message);
    }
  };

  const grantReward = async (rewardType) => {
    if (rewardType === 'energy') {
      setEnergy(maxEnergy);
      syncWithSupabase(points, maxEnergy);
    } else if (rewardType === 'autobot') {
      setHasAutobot(true);
      syncWithSupabase(points, energy, true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-slate-950 text-white font-sans p-4 select-none overflow-hidden relative pb-20">
      <div className="absolute top-[-20%] left-[-20%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* ID Gösterge Alanı */}
      <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 px-4 py-1.5 rounded-xl text-xs text-slate-300 flex justify-center items-center z-10 mb-2">
        <span className="text-slate-400">Telegram ID: <strong className="text-cyan-400">{telegramId}</strong></span>
      </div>

      {/* Üst Bar (Oyun Ekranı İçin) */}
      {activeTab !== 'profile' && (
        <div className="w-full max-w-md flex justify-between items-center bg-slate-900/85 backdrop-blur-md border border-slate-800 p-4 rounded-2xl shadow-xl z-10">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-widest">CoreTap</span>
            <h1 className="text-3xl font-black text-yellow-400 tracking-wider">💎 {points.toLocaleString()}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowDailyModal(true)}
              className="bg-purple-600/30 border border-purple-500/50 text-purple-300 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-purple-600/50 transition-colors cursor-pointer"
            >
              🎁 Günlük {claimedToday ? '✅' : ''}
            </button>
            <div className="text-right">
              <span className="text-xs text-slate-400 uppercase tracking-widest">Lig</span>
              <p className={`text-sm font-bold ${currentLeague.color}`}>{currentLeague.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* OYUN SEKMESİ */}
      {activeTab === 'game' && (
        <div className="flex flex-col items-center justify-center my-auto z-10 relative w-full">
          {mySquad && (
            <div className="mb-4 bg-slate-900/60 border border-slate-800 px-4 py-2 rounded-xl text-xs text-slate-300 flex items-center gap-2">
              <span>🛡️ Klanın:</span>
              <span className="text-cyan-400 font-bold">{mySquad.name}</span>
            </div>
          )}

          {hasAutobot && (
            <div className="mb-4 bg-purple-950/40 border border-purple-500/40 px-3 py-1.5 rounded-xl text-[11px] text-purple-300 flex items-center gap-2 animate-pulse">
              <span>🤖 Auto-Bot Aktif:</span>
              <span className="text-yellow-400 font-bold">Pasif Gelir Kasılıyor (+5 / 3sn)</span>
            </div>
          )}

          <div 
            onClick={handleTap}
            className="relative w-56 h-56 rounded-full bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 p-2 shadow-[0_0_50px_rgba(79,70,229,0.4)] active:scale-95 transition-transform duration-75 cursor-pointer flex items-center justify-center group"
          >
            <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center border-4 border-slate-800 group-hover:border-cyan-400 transition-colors overflow-hidden">
              <img src="/logo.jpg" alt="CoreTap Logo" className="w-28 h-28 object-contain pointer-events-none" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 tracking-wider">Tık Başına Güç: <span className="text-yellow-400">+{tapPower}</span></p>
        </div>
      )}

      {/* KLANLAR SEKMESİ */}
      {activeTab === 'squads' && (
        <div className="w-full max-w-md my-auto z-10 flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
            <h2 className="text-lg font-black text-white mb-1">👥 Klan Sistemi</h2>
            <p className="text-xs text-slate-400 mb-4">Klan kurmak <span className="text-yellow-400 font-bold">⭐ 300 Stars</span> tutar (Maks. 20 Üye).</p>

            {!mySquad ? (
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Klan Adı..."
                  value={squadNameInput}
                  onChange={(e) => setSquadNameInput(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 flex-1"
                />
                <button 
                  onClick={handleCreateSquadStars}
                  className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Klan Kur (⭐ 300)
                </button>
              </div>
            ) : (
              <div className="bg-purple-950/30 border border-purple-500/40 p-4 rounded-xl flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs text-purple-400 block">Aktif Klanın {mySquad.leader_telegram_id === telegramId ? '(👑 Başkan)' : ''}</span>
                    <span className="font-bold text-white text-base">{mySquad.name}</span>
                  </div>
                  <button 
                    onClick={handleLeaveSquad}
                    className="text-xs bg-red-500/20 border border-red-500/40 text-red-300 px-3 py-1.5 rounded-lg cursor-pointer"
                  >
                    Ayrıl
                  </button>
                </div>

                <div className="border-t border-purple-500/30 pt-2 mt-1">
                  <span className="text-[11px] text-slate-400 block mb-2">Klan Üyeleri ({squadMembers.length}/20):</span>
                  <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                    {squadMembers.map((member) => (
                      <div key={member.telegram_id} className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg text-xs">
                        <span className="text-slate-200">{member.username} {member.telegram_id === mySquad.leader_telegram_id ? '👑' : ''}</span>
                        {mySquad.leader_telegram_id === telegramId && member.telegram_id !== telegramId && (
                          <button 
                            onClick={() => handleKickMember(member.telegram_id)}
                            className="text-[10px] bg-red-600/30 text-red-300 px-2 py-0.5 rounded border border-red-500/30 cursor-pointer hover:bg-red-600/50"
                          >
                            At
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
            <h3 className="text-sm font-bold text-slate-300 mb-3">Tüm Klanlar</h3>
            <div className="flex flex-col gap-2">
              {squadsList.map((squad, index) => (
                <div key={squad.id} className="bg-slate-800/50 border border-slate-700/60 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-cyan-400">#{index + 1} {squad.name}</span>
                    <p className="text-[10px] text-slate-400">{squad.members_count}/20 Üye</p>
                  </div>
                  {!mySquad ? (
                    <button 
                      onClick={() => handleJoinSquad(squad)}
                      className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      Katıl
                    </button>
                  ) : mySquad.id === squad.id ? (
                    <span className="text-xs text-green-400 font-bold">Senin Klansın</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GÖREVLER SEKMESİ */}
      {activeTab === 'quests' && (
        <div className="w-full max-w-md my-auto z-10 flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
            <h2 className="text-lg font-black text-white mb-1">🎯 Sosyal Görevler</h2>
            <p className="text-xs text-slate-400 mb-4">X (Twitter)'da bizi takip et, anında ekstra koinleri kap!</p>

            <div className="flex flex-col gap-3">
              <div className="bg-slate-800/50 border border-slate-700/60 p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">X'te Takip Et (@coretapofficial)</span>
                  <span className="text-[10px] text-yellow-400 font-semibold">+500 💎</span>
                </div>
                <button 
                  onClick={handleCompleteTwitterQuest}
                  disabled={twitterCompleted}
                  className={`text-xs font-bold px-4 py-2 rounded-xl cursor-pointer ${
                    twitterCompleted 
                      ? 'bg-green-600/30 border border-green-500/40 text-green-300 cursor-not-allowed' 
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                >
                  {twitterCompleted ? 'Tamamlandı ✅' : 'Takip Et & Kazan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAĞAZA SEKMESİ */}
      {activeTab === 'store' && (
        <div className="w-full max-w-md my-auto z-10 flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border border-purple-500/40 p-4 rounded-2xl shadow-xl">
            <h2 className="text-sm font-black text-purple-300 mb-1">⭐ Telegram Stars / VIP Mağaza</h2>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button 
                onClick={() => buyTelegramStarsPackage('Full Enerji', 100, 'energy')}
                className="bg-slate-900/80 border border-purple-500/30 p-3 rounded-xl text-left cursor-pointer"
              >
                <span className="text-base block mb-1">⚡</span>
                <span className="font-bold text-xs text-white block">Full Enerji</span>
                <span className="text-[10px] text-yellow-400 font-semibold">⭐ 100 Stars</span>
              </button>
              <button 
                onClick={() => buyTelegramStarsPackage('Auto-Bot', 500, 'autobot')}
                disabled={hasAutobot}
                className={`border p-3 rounded-xl text-left ${hasAutobot ? 'bg-slate-800 border-slate-700 opacity-60 cursor-not-allowed' : 'bg-slate-900/80 border-purple-500/30 cursor-pointer'}`}
              >
                <span className="text-base block mb-1">🤖</span>
                <span className="font-bold text-xs text-white block">{hasAutobot ? 'Auto-Bot Aktif ✅' : 'Auto-Bot'}</span>
                <span className="text-[10px] text-yellow-400 font-semibold">{hasAutobot ? 'Satın Alındı' : '⭐ 500 Stars'}</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
            <h3 className="text-sm font-bold text-slate-300 mb-3">Oyun İçi Geliştirmeler</h3>
            <div className="flex flex-col gap-2">
              <div className="bg-slate-800/50 border border-slate-700/60 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-cyan-400">Multitap (Güç: {tapPower})</span>
                </div>
                <button 
                  onClick={buyMultitap}
                  className="bg-cyan-500 text-slate-950 font-bold text-xs px-3 py-2 rounded-xl cursor-pointer"
                >
                  {(2000 * tapPower).toLocaleString()} 💎
                </button>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/60 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-cyan-400">Enerji Tankı (Max: {maxEnergy})</span>
                </div>
                <button 
                  onClick={buyEnergyTank}
                  className="bg-cyan-500 text-slate-950 font-bold text-xs px-3 py-2 rounded-xl cursor-pointer"
                >
                  3,000 💎
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROFİL SEKMESİ */}
      {activeTab === 'profile' && (
        <div className="w-full max-w-md my-auto z-10 flex flex-col items-center gap-4 py-6">
          <div className="w-24 h-24 rounded-full bg-amber-700/80 border-4 border-amber-500/50 flex items-center justify-center text-4xl font-black text-white shadow-xl shadow-amber-900/40">
            {firstName.charAt(0).toUpperCase()}
          </div>
          
          <h2 className="text-2xl font-black tracking-widest text-white uppercase drop-shadow-md">
            {firstName}
          </h2>

          <div className="w-full bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col gap-3 mt-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Toplam Bakiye:</span>
              <span className="font-bold text-yellow-400">💎 {points.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Mevcut Lig:</span>
              <span className={`font-bold ${currentLeague.color}`}>{currentLeague.name}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Kullanıcı Adı:</span>
              <span className="font-bold text-cyan-400">@{username}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'game' && (
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-2xl shadow-xl z-10 mb-4">
          <div className="flex justify-between text-xs font-semibold mb-2 text-slate-300">
            <span>⚡ ENERJİ</span>
            <span>{energy} / {maxEnergy}</span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-yellow-400 rounded-full transition-all duration-300"
              style={{ width: `${(energy / maxEnergy) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Navigasyon Çubuğu */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md grid grid-cols-5 gap-1 bg-slate-900/95 backdrop-blur-md border border-slate-800 p-2 rounded-2xl z-50 text-center text-[10px] font-medium text-slate-400 shadow-2xl">
        <button onClick={() => setActiveTab('store')} className={`flex flex-col items-center justify-center py-1.5 rounded-xl cursor-pointer ${activeTab === 'store' ? 'bg-slate-800 text-cyan-400' : 'hover:bg-slate-800 hover:text-white'}`}>
          <span className="text-sm">🛍️</span>
          <span>Store</span>
        </button>
        <button onClick={() => setActiveTab('squads')} className={`flex flex-col items-center justify-center py-1.5 rounded-xl cursor-pointer ${activeTab === 'squads' ? 'bg-slate-800 text-cyan-400' : 'hover:bg-slate-800 hover:text-white'}`}>
          <span className="text-sm">🛡️</span>
          <span>Squads</span>
        </button>
        <button onClick={() => setActiveTab('game')} className={`flex flex-col items-center justify-center py-1.5 rounded-xl cursor-pointer ${activeTab === 'game' ? 'bg-slate-800 text-cyan-400' : 'hover:bg-slate-800 hover:text-white'}`}>
          <span className="text-sm">⚡</span>
          <span>Game</span>
        </button>
        <button onClick={() => setActiveTab('quests')} className={`flex flex-col items-center justify-center py-1.5 rounded-xl cursor-pointer ${activeTab === 'quests' ? 'bg-slate-800 text-cyan-400' : 'hover:bg-slate-800 hover:text-white'}`}>
          <span className="text-sm">🎯</span>
          <span>Quests</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center justify-center py-1.5 rounded-xl cursor-pointer ${activeTab === 'profile' ? 'bg-slate-800 text-cyan-400' : 'hover:bg-slate-800 hover:text-white'}`}>
          <span className="text-sm">👤</span>
          <span>Profile</span>
        </button>
      </div>

      {showDailyModal && (
        <div 
          onClick={() => setShowDailyModal(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative cursor-default"
          >
            <button 
              onClick={() => setShowDailyModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <span className="text-3xl">🎁</span>
              <h2 className="text-xl font-black text-white mt-2">Günlük Giriş</h2>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-6">
              {dailyRewards.map((item) => (
                <div key={item.day} className={`p-3 rounded-2xl flex flex-col items-center justify-center border ${item.day === streakDay ? 'bg-purple-600/20 border-purple-500' : 'bg-slate-800 border-slate-700'}`}>
                  <span className="text-xs text-slate-400">Gün {item.day}</span>
                  <span className="text-base font-black text-yellow-400">+{item.reward}</span>
                </div>
              ))}
            </div>
            <button 
              onClick={() => claimDailyReward(dailyRewards[streakDay - 1].reward)}
              disabled={claimedToday}
              className={`w-full py-3.5 font-bold rounded-2xl transition-colors ${
                claimedToday 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white cursor-pointer'
              }`}
            >
              {claimedToday ? 'Bugün Alındı ✅' : 'Ödülü Al 🚀'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}