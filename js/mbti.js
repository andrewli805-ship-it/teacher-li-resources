/**
 * Classroom MBTI-style quiz. Answers stay in memory only.
 * Reload returns to the intro. Quiz answers are not stored.
 *
 * Scoring: each chosen pole scores +1. The higher pole wins.
 * Hardcoded tie-break: a 4:4 tie resolves to I, N, F, and P.
 */
(function () {
  var TIE_POLE = { EI: "I", SN: "N", TF: "F", JP: "P" };
  var DIMENSIONS = ["EI", "SN", "TF", "JP"];

  var POLE_LABEL = {
    E: { zh: "外向", en: "Extraversion" },
    I: { zh: "內向", en: "Introversion" },
    S: { zh: "實感", en: "Sensing" },
    N: { zh: "直覺", en: "Intuition" },
    T: { zh: "思考", en: "Thinking" },
    F: { zh: "情感", en: "Feeling" },
    J: { zh: "判斷", en: "Judging" },
    P: { zh: "感知", en: "Perceiving" },
  };

  var QUESTIONS = [
    {
      dim: "EI",
      zh: "假日有空時，你比較想怎樣過？",
      en: "On a free day, what do you feel like doing?",
      options: [
        { pole: "E", zh: "約同學出去走走，一起做點活動", en: "Ask classmates to go out and do something together" },
        { pole: "I", zh: "留在自己喜歡的地方，安靜地過", en: "Stay somewhere you like and have a quiet day" },
      ],
    },
    {
      dim: "EI",
      zh: "小組討論時，你通常會怎樣？",
      en: "In a group discussion, what do you usually do?",
      options: [
        { pole: "I", zh: "先在心裡想清楚，再舉手發言", en: "Think it through first, then put your hand up" },
        { pole: "E", zh: "一邊說，一邊整理自己的想法", en: "Talk it out while you are still figuring it out" },
      ],
    },
    {
      dim: "EI",
      zh: "班上轉來新同學，你通常會？",
      en: "A new classmate joins the class. What do you usually do?",
      options: [
        { pole: "E", zh: "很快打開話匣子，主動聊天", en: "Start a conversation easily" },
        { pole: "I", zh: "需要多一點時間，才慢慢熟絡", en: "Need more time before you feel you know them" },
      ],
    },
    {
      dim: "EI",
      zh: "忙了一整天，你怎樣才覺得回復精神？",
      en: "After a long day, how do you feel like yourself again?",
      options: [
        { pole: "I", zh: "一個人安靜待着，充充電", en: "Spend time alone and recharge" },
        { pole: "E", zh: "找人聊天，或參加有來有往的活動", en: "Chat with people or join something lively" },
      ],
    },
    {
      dim: "EI",
      zh: "老師點名請你向全班分享，你的感覺是？",
      en: "The teacher calls on you to share with the whole class. How do you feel?",
      options: [
        { pole: "E", zh: "不太害怕，可以站出來說", en: "Not very nervous — you can stand up and speak" },
        { pole: "I", zh: "會緊張，希望不必在很多人面前說", en: "Nervous, and you hope you do not have to speak in front of everyone" },
      ],
    },
    {
      dim: "EI",
      zh: "短訊或群組一下子來了很多訊息，你會？",
      en: "A lot of messages arrive at once. What do you do?",
      options: [
        { pole: "I", zh: "先靜一靜，想好再回", en: "Pause, then reply when you know what to say" },
        { pole: "E", zh: "想盡快回覆，跟上大家的對話", en: "Want to reply right away and stay in the conversation" },
      ],
    },
    {
      dim: "EI",
      zh: "和朋友去旅行，你比較喜歡哪種安排？",
      en: "On a trip with friends, which plan do you prefer?",
      options: [
        { pole: "E", zh: "行程排得滿滿的，一直有活動", en: "A full schedule, with something happening most of the time" },
        { pole: "I", zh: "行程少一點，留時間給自己", en: "A lighter schedule, with time left for yourself" },
      ],
    },
    {
      dim: "EI",
      zh: "如果用一句話形容自己，你較像？",
      en: "Which sentence describes you better?",
      options: [
        { pole: "I", zh: "先在旁邊觀察，再決定要不要加入", en: "You watch first, then decide whether to join" },
        { pole: "E", zh: "常常在活動的中心，帶動氣氛", en: "You are often in the middle of the activity" },
      ],
    },
    {
      dim: "SN",
      zh: "學一樣新東西時，你比較想先掌握？",
      en: "When you learn something new, what do you want first?",
      options: [
        { pole: "S", zh: "具體步驟，照着做就會", en: "Concrete steps you can follow" },
        { pole: "N", zh: "背後的大概念，先明白整體", en: "The big idea, so you see the whole picture" },
      ],
    },
    {
      dim: "SN",
      zh: "讀故事或看影片時，你更留意？",
      en: "When you read a story or watch a film, what do you notice more?",
      options: [
        { pole: "N", zh: "隱喻、主題，和它想說的意思", en: "The metaphor and what it is trying to say" },
        { pole: "S", zh: "情節怎樣發生，細節是否合理", en: "How the plot happens, and whether the details make sense" },
      ],
    },
    {
      dim: "SN",
      zh: "做專題的第一步，你傾向？",
      en: "What is your first step on a project?",
      options: [
        { pole: "S", zh: "先列出要做的清單", en: "Make a list of what has to be done" },
        { pole: "N", zh: "先和大家腦力激盪，拋出想法", en: "Brainstorm and throw ideas around" },
      ],
    },
    {
      dim: "SN",
      zh: "老師發作業說明時，你最先想知道？",
      en: "When the teacher explains an assignment, what do you want to know first?",
      options: [
        { pole: "N", zh: "為什麼要做，這次的目標是什麼", en: "Why you are doing it, and what the goal is" },
        { pole: "S", zh: "格式怎樣，截止日期是哪一天", en: "The format and the deadline" },
      ],
    },
    {
      dim: "SN",
      zh: "你覺得「做得好」比較是指？",
      en: "What does “doing well” mean to you?",
      options: [
        { pole: "S", zh: "有可以量度的成果，例如分數或完成的項目", en: "A result you can measure, such as a mark or a finished item" },
        { pole: "N", zh: "自己有成長，過程有意義", en: "Growth, and a process that feels meaningful" },
      ],
    },
    {
      dim: "SN",
      zh: "收拾房間或書包時，你的做法較像？",
      en: "When you tidy your room or your bag, what is more like you?",
      options: [
        { pole: "N", zh: "大方向整齊就好，不必每樣都卡在固定位置", en: "Mostly neat is enough; not everything needs a fixed spot" },
        { pole: "S", zh: "東西放回固定位置，下次才找得到", en: "Put things back in the same place so you can find them" },
      ],
    },
    {
      dim: "SN",
      zh: "解題或做練習時，你通常？",
      en: "When you solve a problem, what do you usually do?",
      options: [
        { pole: "S", zh: "跟着學過的步驟，一步一步做", en: "Follow the steps you were taught" },
        { pole: "N", zh: "試不同方法，看看哪一條走得通", en: "Try different methods and see which one works" },
      ],
    },
    {
      dim: "SN",
      zh: "和朋友閒聊時，你比較容易聊到？",
      en: "When you chat with friends, what do you drift toward?",
      options: [
        { pole: "N", zh: "理想、未來，和「如果可以的話」", en: "Ideals, the future, and “what if”" },
        { pole: "S", zh: "實用資訊，例如怎樣做、在哪裡、何時", en: "Useful information: how, where, and when" },
      ],
    },
    {
      dim: "TF",
      zh: "朋友很難過，你第一個反應是？",
      en: "A friend is upset. What is your first response?",
      options: [
        { pole: "T", zh: "幫對方分析原因，給具體建議", en: "Analyse what happened and offer a practical suggestion" },
        { pole: "F", zh: "先陪伴，讓對方覺得有人在", en: "Stay with them so they feel someone is there" },
      ],
    },
    {
      dim: "TF",
      zh: "班上比賽要評分，你更看重？",
      en: "The class is scoring a contest. What matters more to you?",
      options: [
        { pole: "F", zh: "過程公不公平，大家的感受如何", en: "Whether it felt fair, and how people feel" },
        { pole: "T", zh: "有沒有依照標準，結果是否清楚", en: "Whether the standard was followed and the result is clear" },
      ],
    },
    {
      dim: "TF",
      zh: "和別人意見不合時，你傾向？",
      en: "You disagree with someone. What do you tend to do?",
      options: [
        { pole: "T", zh: "把道理講清楚，對事不對人", en: "Explain the reasoning and stick to the issue" },
        { pole: "F", zh: "先顧關係，避免弄僵氣氛", en: "Look after the relationship and avoid a cold atmosphere" },
      ],
    },
    {
      dim: "TF",
      zh: "選組長時，你較想選怎樣的人？",
      en: "When you choose a group leader, whom do you want?",
      options: [
        { pole: "F", zh: "懂體諒、能照顧小組氣氛的人", en: "Someone considerate who can look after the mood of the group" },
        { pole: "T", zh: "決斷、能把事情推進的人", en: "Someone decisive who gets the work moving" },
      ],
    },
    {
      dim: "TF",
      zh: "看到有爭議的新聞，你先注意？",
      en: "You see a controversial news story. What do you notice first?",
      options: [
        { pole: "T", zh: "事實和邏輯成不成立", en: "Whether the facts and the logic hold" },
        { pole: "F", zh: "事件對人的心情和影響", en: "How it affects people’s feelings" },
      ],
    },
    {
      dim: "TF",
      zh: "自己做錯事之後，你最先想到？",
      en: "After you make a mistake, what do you think of first?",
      options: [
        { pole: "F", zh: "有沒有傷害到別人", en: "Whether anyone was hurt" },
        { pole: "T", zh: "哪一個步驟出錯，下次怎樣改", en: "Which step went wrong, and how to change it next time" },
      ],
    },
    {
      dim: "TF",
      zh: "參加辯論或討論，你比較着重？",
      en: "In a debate or a discussion, what do you focus on?",
      options: [
        { pole: "T", zh: "論點和例子是否站得住", en: "Whether the points and examples stand up" },
        { pole: "F", zh: "說話方式能否說服人，也顧及對方立場", en: "Whether the way of speaking persuades people and respects their position" },
      ],
    },
    {
      dim: "TF",
      zh: "送禮給朋友，你更在意？",
      en: "When you give a friend a present, what matters more?",
      options: [
        { pole: "F", zh: "心意有沒有傳到", en: "Whether the thought comes through" },
        { pole: "T", zh: "對方實際用不用得到", en: "Whether they can actually use it" },
      ],
    },
    {
      dim: "JP",
      zh: "交功課前一晚，你通常是？",
      en: "The night before homework is due, what is more like you?",
      options: [
        { pole: "J", zh: "早就做完，可以安心", en: "You finished earlier and can relax" },
        { pole: "P", zh: "在期限前衝刺，趕工完成", en: "You sprint and finish just before the deadline" },
      ],
    },
    {
      dim: "JP",
      zh: "出門旅行前收拾行李，你會？",
      en: "Packing for a trip, what do you do?",
      options: [
        { pole: "P", zh: "到要走的時候再看要帶什麼", en: "Decide what to bring when it is time to leave" },
        { pole: "J", zh: "提前列清單，一樣一樣準備好", en: "Make a list ahead of time and prepare each item" },
      ],
    },
    {
      dim: "JP",
      zh: "週末怎樣安排，你比較喜歡？",
      en: "How do you like to spend a weekend?",
      options: [
        { pole: "J", zh: "先有一個時間表", en: "Start with a schedule" },
        { pole: "P", zh: "看當天心情再決定", en: "See how you feel on the day" },
      ],
    },
    {
      dim: "JP",
      zh: "發現進度落後時，你會？",
      en: "You are behind. What do you do?",
      options: [
        { pole: "P", zh: "彈性調整，先做眼前最要緊的", en: "Adjust as you go and do the most urgent part first" },
        { pole: "J", zh: "重新排期限，把剩下的工作排好", en: "Reset the deadlines and reschedule the remaining work" },
      ],
    },
    {
      dim: "JP",
      zh: "你的書桌通常是？",
      en: "What is your desk usually like?",
      options: [
        { pole: "J", zh: "分類清楚，用完放回原位", en: "Sorted clearly, and things go back where they belong" },
        { pole: "P", zh: "有點亂，但你找得到要用的東西", en: "A bit messy, but you can find what you need" },
      ],
    },
    {
      dim: "JP",
      zh: "計劃突然要改，你的感受是？",
      en: "A plan has to change. How do you feel?",
      options: [
        { pole: "P", zh: "還好，改一改也可以", en: "It is all right — you can change it" },
        { pole: "J", zh: "會想盡量維持原來的安排", en: "You would rather keep the original plan" },
      ],
    },
    {
      dim: "JP",
      zh: "面對一份大作業，你會先？",
      en: "Facing a large assignment, what do you do first?",
      options: [
        { pole: "J", zh: "寫大綱和時程，再開始做", en: "Write an outline and a timeline, then start" },
        { pole: "P", zh: "先做自己有興趣的部分", en: "Start with the part you are interested in" },
      ],
    },
    {
      dim: "JP",
      zh: "同學通常會怎樣說你？",
      en: "How would classmates describe you?",
      options: [
        { pole: "P", zh: "隨興、有彈性，遇到變化也能轉", en: "Easy-going and flexible; you can turn when things change" },
        { pole: "J", zh: "守時、有條理，做事有計劃", en: "Punctual and orderly; you work from a plan" },
      ],
    },
  ];

  var TYPES = {
    INTJ: {
      name: { zh: "策略家型", en: "Architect" },
      blurb: {
        zh: "你習慣先想清楚目標，再決定怎樣用最少的彎路走過去。做專題時，你會自己找方法，不太喜歡沒有說明的忙碌。你能夠長時間專注，把一件事做深。同學可能覺得你話少，但其實你已經在心裡排好順序。若你肯把計劃說出來，小組會更明白你的想法。",
        en: "You like to see the goal first, then plan a route with as few wasted steps as possible. In projects you look for a reason before you spend effort, and you can stay with one hard problem for a long time. Classmates may think you are quiet, while you are already ordering the next steps in your head. Say the plan out loud and the group will understand you better.",
      },
    },
    INTP: {
      name: { zh: "邏輯學家型", en: "Logician" },
      blurb: {
        zh: "你對「為什麼會這樣」特別有興趣，喜歡把一個概念拆開再重新拼好。新知識進來時，你會在腦裡試很多可能，直到說得通才肯停。你不急着跟大家用同一種做法，寧可慢一點，也要把道理弄明白。記得給自己一個交得出的終點，好點子才不會一直停在草稿裡。",
        en: "You want to know why something works, and you enjoy taking an idea apart until it makes sense. You would rather be a little slower than copy a method you do not understand. New possibilities keep opening while you think, which is a strength and also a trap. Give yourself a finish line so a good idea actually gets handed in.",
      },
    },
    ENTJ: {
      name: { zh: "指揮官型", en: "Commander" },
      blurb: {
        zh: "你看得準目標，也敢把人和時間組織起來。小組裡你常常自然地分工、定進度、追結果。你說話直接，重視效率。催促別人之前，先講清楚原因，同伴會更願意跟上。你的長處是把模糊的想法變成可以執行的計劃。",
        en: "You spot the goal and you are willing to organize people and time around it. In a group you often divide the work, set the pace, and check the result. You speak directly and care about getting things done. Explain the reason before you push, and teammates will follow you more willingly. Your strength is turning a vague idea into a plan people can carry out.",
      },
    },
    ENTP: {
      name: { zh: "辯論家型", en: "Debater" },
      blurb: {
        zh: "你反應快，喜歡用新角度看看舊問題。討論時你常常提出別人沒想到的可能，也享受一來一往的辯證。點子來得多，開始很容易，收尾就要提醒自己。選一個最值得做的想法做完，比同時開很多題目更有力量。",
        en: "You think quickly and like to turn a familiar problem around to see it from a new side. Discussions energize you, and you often raise a possibility nobody else has named. Starting is easy; finishing takes a reminder. Choose the idea most worth doing and complete it. One finished piece is stronger than ten open ones.",
      },
    },
    INFJ: {
      name: { zh: "提倡者型", en: "Advocate" },
      blurb: {
        zh: "你在意一件事有沒有意義，也在意人的感受。你常常先觀察，再默默幫同學走到比較好的方向。你對未來有自己的畫面，願意為了那個畫面耐心做下去。人多的時候你會累，需要安靜把想法放好。當你把在乎的事說清楚，小組就會明白為什麼要這樣做。",
        en: "You care whether something matters, and you care how people feel. You often watch first, then quietly help someone move toward a better direction. You hold a picture of the future and you are patient enough to work toward it. Crowds tire you, so you need quiet time to sort your thoughts. When you say what you care about, the group understands why the work matters.",
      },
    },
    INFP: {
      name: { zh: "調停者型", en: "Mediator" },
      blurb: {
        zh: "你做事前會問：這件事跟自己的心意合不合。你聽得懂朋友沒說出口的心情，也願意陪對方慢慢想。寫作、設計或幫人調解，都是你容易發揮的地方。給自己清楚而溫柔的期限，在乎的事就不會只留在心裡。",
        en: "Before you commit, you ask whether the task fits what you believe. You notice feelings your friends do not say out loud, and you are willing to stay with them while they figure things out. Writing, design, and helping people settle a disagreement are natural places for you. A clear but kind deadline keeps what you care about from staying only in your head.",
      },
    },
    ENFJ: {
      name: { zh: "主人公型", en: "Protagonist" },
      blurb: {
        zh: "你容易看見每個人的長處，也願意把大家拉在一起。當組長時，你不但管進度，還會留意有沒有人被忽略。你說話有感染力，能讓同學願意一起做。別把所有人的情緒都扛在自己身上，你的關心才走得遠。",
        en: "You notice what each person is good at, and you want the group to succeed together. As a leader you watch the schedule and also notice who is being left out. People listen because you make the work feel worthwhile. Do not carry everyone’s feelings by yourself. Your care lasts longer when you leave some of the weight with the team.",
      },
    },
    ENFP: {
      name: { zh: "競選者型", en: "Campaigner" },
      blurb: {
        zh: "你好奇心強，新點子一來就想立刻試試。你能把沉悶的題目說得有趣，也容易把身邊的人帶動起來。太死的步驟會讓你失去動力，但完全沒有規格又會交不出作業。先做最有興趣的部分，再補上必要的要求，作品就會又有活力又完整。",
        en: "A new idea makes you want to try it immediately. You can make a dull topic sound interesting, and your energy lifts the people around you. Strict steps drain you, but no structure at all means the work never gets submitted. Start with the part that excites you, then add the requirements the task actually needs. The result can be both lively and complete.",
      },
    },
    ISTJ: {
      name: { zh: "物流師型", en: "Logistician" },
      blurb: {
        zh: "你說到的事，通常會按時做完。你喜歡清楚的步驟、固定的格式，和可以核對的清單。溫習和作業上，你靠穩定的練習，而不是臨時的靈感。變化很多時你會不自在，可以先保留有效的做法，再小幅調整。",
        en: "If you say you will do something, it is usually finished on time. You like clear steps, a known format, and a list you can check. Revision works better for you as steady practice than as a last-minute spark. Lots of sudden change is uncomfortable. Keep the method that already works, then adjust it a little.",
      },
    },
    ISFJ: {
      name: { zh: "守衛者型", en: "Defender" },
      blurb: {
        zh: "你細心，記得同學提過的小事，也願意在背後把缺漏補好。你重視責任，小組的細節很少在你手上漏掉。你不愛站到最前面，但沒有你，很多事會亂。幫助別人的同時，也留給自己休息的時間。",
        en: "You remember small things classmates mention, and you quietly fill gaps other people miss. You take responsibility seriously, so group details rarely fall through your hands. You do not need to stand at the front, but the work gets messy without you. While you look after others, leave some time to rest yourself.",
      },
    },
    ESTJ: {
      name: { zh: "總經理型", en: "Executive" },
      blurb: {
        zh: "你做事有條理，喜歡責任清楚、規則說明白。你能把大任務拆成：誰做什麼、何時完成。你看重公平的標準，多於一時的感覺。先聽完不同做法再拍板，你的決定會更穩，大家也更服氣。",
        en: "You like the work to be orderly, with roles and rules stated plainly. You can split a big task into who does what and by when. You trust a fair standard more than a passing mood. Listen to the other approaches before you decide. The choice is steadier, and the group is more willing to follow it.",
      },
    },
    ESFJ: {
      name: { zh: "執政官型", en: "Consul" },
      blurb: {
        zh: "你在意班上的氣氛，也願意把人照顧好。分組、活動和班級事務裡，你常常記得每個人需要什麼。你喜歡具體、有用、大家都能參與的安排。把標準說清楚，你的熱心會被看成可靠，而不只是好心。",
        en: "You notice the mood of the class and you want people to be looked after. In group work and class activities you often remember what each person needs. You prefer plans that are concrete, useful, and open to everyone. Say the standard out loud. Then your care looks reliable, not only kind.",
      },
    },
    ISTP: {
      name: { zh: "鑑賞家型", en: "Virtuoso" },
      blurb: {
        zh: "你喜歡自己動手試，在操作裡學會一件事。問題出現時你很冷靜，先看現在能處理哪一部分。你話不多，但關鍵的時候很管用。給你工具、清楚的目標和一點空間，你往往找得到實際可行的做法。",
        en: "You learn by trying the thing yourself. When a problem shows up, you stay calm and deal with the part you can fix now. You do not talk much, and you are useful at the moment that matters. Give yourself tools, a clear aim, and a little room. You will usually find a practical way through.",
      },
    },
    ISFP: {
      name: { zh: "探險家型", en: "Adventurer" },
      blurb: {
        zh: "你用自己的節奏感受世界，在意真實、舒服和是否出於本心。你不喜歡被比較，也不喜歡被催着變成另一個人。設計、運動或任何能親手做的活動，都可能是你的出口。小步開始、保留選擇，你會比被緊迫盯着時做得更好。",
        en: "You move at your own pace and you care whether something feels honest and comfortable. You do not like being compared, or being hurried into becoming someone else. Design, sport, and anything you can make with your hands can be a good outlet. Start small and keep some choice. You do better that way than when someone stands over you.",
      },
    },
    ESTP: {
      name: { zh: "事業家型", en: "Entrepreneur" },
      blurb: {
        zh: "你行動快，喜歡在真實情況裡作決定，而不是先寫很長的計劃。突發狀況來的時候，你往往能立刻應對。你精力充足，適合需要臨場反應的活動。動手之前先用一分鐘看清底線，衝勁會更安全，也更有效。",
        en: "You decide in the real situation rather than writing a long plan first. When something unexpected happens, you can respond immediately. You have energy for activities that need a quick reaction. Take one minute to see the limit before you jump in. Your drive is safer and more effective with that line in view.",
      },
    },
    ESFP: {
      name: { zh: "娛樂家型", en: "Entertainer" },
      blurb: {
        zh: "你活在當下，容易把氣氛帶起來，讓身邊的人放鬆。學習時你喜歡有例子、有互動，不太喜歡只看長篇說明。你大方、友善，同學願意找你一起做。好玩的事很容易把作業擠掉，所以要把「做完」也算進好玩裡。這樣你既能盡興，也能交得出作品。",
        en: "You are present in the moment, and you make it easier for people around you to relax. You learn better from examples and interaction than from a long explanation alone. You are open and friendly, so classmates want to work with you. Fun can push homework aside, so count finishing as part of the fun. Then you can enjoy the work and still hand it in.",
      },
    },
  };

  function scoreAnswers(answers) {
    var totals = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
    QUESTIONS.forEach(function (q, i) {
      var pole = answers[i];
      if (!pole || !Object.prototype.hasOwnProperty.call(totals, pole)) return;
      totals[pole] += 1;
    });
    var code = "";
    var poles = [];
    DIMENSIONS.forEach(function (dim) {
      var first = dim.charAt(0);
      var second = dim.charAt(1);
      var winner;
      if (totals[first] > totals[second]) winner = first;
      else if (totals[second] > totals[first]) winner = second;
      else winner = TIE_POLE[dim];
      code += winner;
      poles.push(winner);
    });
    return { code: code, poles: poles, totals: totals };
  }

  var api = {
    questions: QUESTIONS,
    types: TYPES,
    tiePole: TIE_POLE,
    scoreAnswers: scoreAnswers,
  };
  if (typeof window !== "undefined") window.TeacherLiMbti = api;

  if (typeof document === "undefined") return;

  var state = {
    screen: "intro",
    index: 0,
    answers: [],
  };

  function blankAnswers() {
    return QUESTIONS.map(function () {
      return null;
    });
  }

  function lang() {
    if (window.TeacherLiI18n && window.TeacherLiI18n.getLang() === "en") return "en";
    return "zh";
  }

  function tf(key, vars) {
    var text = window.TeacherLiI18n ? window.TeacherLiI18n.t(key) : key;
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, function (_, name) {
      return vars[name] != null ? String(vars[name]) : "";
    });
  }

  function pick(item) {
    var L = lang();
    return item[L] || item.zh;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function showScreen(name) {
    state.screen = name;
    ["intro", "quiz", "result"].forEach(function (id) {
      var node = el("mbti-" + id);
      if (!node) return;
      if (id === name) node.removeAttribute("hidden");
      else node.setAttribute("hidden", "");
    });
    if (name === "quiz") renderQuiz();
    if (name === "result") renderResult();
  }

  function renderQuiz() {
    var q = QUESTIONS[state.index];
    var n = state.index + 1;
    var total = QUESTIONS.length;
    var label = tf("mbti.progress", { n: n, total: total });
    var progressText = el("mbti-progress-text");
    var bar = el("mbti-bar");
    var fill = el("mbti-bar-fill");
    var stem = el("mbti-stem");
    var group = el("mbti-options");
    var activeId = document.activeElement && document.activeElement.id;

    progressText.textContent = label;
    bar.setAttribute("aria-valuemin", "1");
    bar.setAttribute("aria-valuemax", String(total));
    bar.setAttribute("aria-valuenow", String(n));
    bar.setAttribute("aria-valuetext", label);
    fill.style.width = (n / total) * 100 + "%";

    stem.textContent = pick(q);
    group.setAttribute("aria-labelledby", "mbti-stem");
    group.replaceChildren();

    q.options.forEach(function (opt, i) {
      var id = "mbti-opt-" + i;
      var choice = document.createElement("label");
      choice.className = "mbti-option";
      if (state.answers[state.index] === opt.pole) choice.classList.add("is-selected");
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "mbti-current";
      input.id = id;
      input.value = opt.pole;
      input.checked = state.answers[state.index] === opt.pole;
      input.addEventListener("change", function () {
        state.answers[state.index] = opt.pole;
        group.querySelectorAll(".mbti-option").forEach(function (label) {
          label.classList.toggle("is-selected", label.querySelector("input").checked);
        });
        updateNav();
      });
      var key = document.createElement("span");
      key.className = "mbti-option-key";
      key.textContent = i === 0 ? "A" : "B";
      var text = document.createElement("span");
      text.className = "mbti-option-text";
      text.textContent = pick(opt);
      choice.appendChild(input);
      choice.appendChild(key);
      choice.appendChild(text);
      group.appendChild(choice);
    });

    updateNav();
    if (activeId && el(activeId) && group.contains(el(activeId))) {
      el(activeId).focus();
    }
  }

  function updateNav() {
    var last = state.index === QUESTIONS.length - 1;
    var answered = state.answers[state.index] != null;
    var prev = el("mbti-prev");
    var next = el("mbti-next");
    prev.disabled = state.index === 0;
    next.disabled = !answered;
    next.textContent = tf(last ? "mbti.seeResult" : "mbti.next");
  }

  function renderResult() {
    var result = scoreAnswers(state.answers);
    var type = TYPES[result.code];
    var L = lang();
    el("mbti-code").textContent = result.code;
    el("mbti-name").textContent = type ? type.name[L] || type.name.zh : "";
    el("mbti-blurb").textContent = type ? type.blurb[L] || type.blurb.zh : "";
    var chips = el("mbti-chips");
    chips.replaceChildren();
    chips.setAttribute("aria-label", L === "en" ? "Four dimensions" : "四個向度");
    result.poles.forEach(function (pole) {
      var item = document.createElement("li");
      item.className = "mbti-chip";
      item.setAttribute("data-pole", pole);
      var letter = document.createElement("span");
      letter.className = "mbti-chip-letter";
      letter.textContent = pole;
      var name = document.createElement("span");
      name.className = "mbti-chip-name";
      name.textContent = POLE_LABEL[pole][L] || POLE_LABEL[pole].zh;
      item.appendChild(letter);
      item.appendChild(name);
      chips.appendChild(item);
    });
  }

  function focusStem() {
    var stem = el("mbti-stem");
    if (stem) stem.focus();
  }

  function onStart() {
    state.answers = blankAnswers();
    state.index = 0;
    showScreen("quiz");
    focusStem();
  }

  function onPrev() {
    if (state.index === 0) return;
    state.index -= 1;
    renderQuiz();
    focusStem();
  }

  function onNext() {
    if (state.answers[state.index] == null) return;
    if (state.index < QUESTIONS.length - 1) {
      state.index += 1;
      renderQuiz();
      focusStem();
      return;
    }
    if (state.answers.some(function (answer) { return answer == null; })) return;
    showScreen("result");
    var code = el("mbti-code");
    if (code) code.focus();
  }

  function onRetake() {
    state.answers = blankAnswers();
    state.index = 0;
    showScreen("intro");
    var start = el("mbti-start");
    if (start) start.focus();
  }

  function onLang() {
    if (state.screen === "quiz") renderQuiz();
    if (state.screen === "result") renderResult();
  }

  function init() {
    state.answers = blankAnswers();
    el("mbti-start").addEventListener("click", onStart);
    el("mbti-prev").addEventListener("click", onPrev);
    el("mbti-next").addEventListener("click", onNext);
    el("mbti-retake").addEventListener("click", onRetake);
    document.addEventListener("langchange", onLang);
    showScreen("intro");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
