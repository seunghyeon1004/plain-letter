/** Answer headings in the reader's language. Everything else in the interface stays English. */
export interface AnswerLabels {
  what: string;
  must: string;
  when: string;
  nothing: string;
  questions: string;
  advice: string;
}

const L: Record<string, AnswerLabels> = {
  en: { what: "What this is", must: "What you must do", when: "By when", nothing: "If you do nothing", questions: "Questions you could ask", advice: "Check the dates and amounts against the letter. This is not legal advice." },
  es: { what: "Qué es", must: "Qué tiene que hacer", when: "Para cuándo", nothing: "Si no hace nada", questions: "Preguntas que puede hacer", advice: "Compruebe las fechas y los importes en la carta. Esto no es asesoramiento legal." },
  de: { what: "Worum es geht", must: "Was Sie tun müssen", when: "Bis wann", nothing: "Wenn Sie nichts tun", questions: "Fragen, die Sie stellen können", advice: "Prüfen Sie Daten und Beträge im Brief. Dies ist keine Rechtsberatung." },
  fr: { what: "De quoi il s’agit", must: "Ce que vous devez faire", when: "Avant quand", nothing: "Si vous ne faites rien", questions: "Questions à poser", advice: "Vérifiez les dates et les montants dans la lettre. Ceci n’est pas un conseil juridique." },
  ja: { what: "これは何か", must: "あなたがすべきこと", when: "期限", nothing: "何もしない場合", questions: "聞いてみるとよい質問", advice: "日付と金額は手紙で確認してください。これは法的助言ではありません。" },
  ko: { what: "무슨 편지인가요", must: "해야 할 일", when: "언제까지", nothing: "아무것도 하지 않으면", questions: "물어볼 만한 질문", advice: "날짜와 금액은 편지 원문과 꼭 대조하세요. 법률 자문이 아닙니다." },
  zh: { what: "这是什么", must: "您需要做什么", when: "截止时间", nothing: "如果您什么都不做", questions: "可以询问的问题", advice: "请对照原信核对日期和金额。本内容不构成法律意见。" },
  vi: { what: "Đây là gì", must: "Bạn cần làm gì", when: "Hạn chót", nothing: "Nếu bạn không làm gì", questions: "Câu hỏi bạn có thể hỏi", advice: "Hãy đối chiếu ngày tháng và số tiền với thư. Đây không phải là tư vấn pháp lý." },
  ar: { what: "ما هذه الرسالة", must: "ما يجب عليك فعله", when: "الموعد النهائي", nothing: "إذا لم تفعل شيئًا", questions: "أسئلة يمكنك طرحها", advice: "تحقّق من التواريخ والمبالغ في الرسالة. هذه ليست استشارة قانونية." },
  uk: { what: "Що це", must: "Що вам потрібно зробити", when: "До якого терміну", nothing: "Якщо нічого не робити", questions: "Питання, які можна поставити", advice: "Звірте дати й суми з листом. Це не юридична консультація." },
  pt: { what: "O que é", must: "O que você precisa fazer", when: "Até quando", nothing: "Se você não fizer nada", questions: "Perguntas que você pode fazer", advice: "Confira as datas e os valores na carta. Isto não é aconselhamento jurídico." },
  pl: { what: "Co to jest", must: "Co musisz zrobić", when: "Do kiedy", nothing: "Jeśli nic nie zrobisz", questions: "Pytania, które możesz zadać", advice: "Sprawdź daty i kwoty w liście. To nie jest porada prawna." },
  tr: { what: "Bu nedir", must: "Ne yapmanız gerekiyor", when: "Ne zamana kadar", nothing: "Hiçbir şey yapmazsanız", questions: "Sorabileceğiniz sorular", advice: "Tarihleri ve tutarları mektupla karşılaştırın. Bu hukuki tavsiye değildir." },
  tl: { what: "Ano ito", must: "Ano ang dapat mong gawin", when: "Hanggang kailan", nothing: "Kung wala kang gagawin", questions: "Mga tanong na maaari mong itanong", advice: "Suriin ang mga petsa at halaga sa sulat. Hindi ito legal na payo." },
  hi: { what: "यह क्या है", must: "आपको क्या करना है", when: "कब तक", nothing: "अगर आप कुछ नहीं करते", questions: "आप ये सवाल पूछ सकते हैं", advice: "तारीख़ों और रकम को पत्र से मिलाकर देखें। यह कानूनी सलाह नहीं है।" },
};

export function answerLabels(lang: string): AnswerLabels {
  return L[lang] ?? L.en!;
}

export function isRtl(lang: string): boolean {
  return lang === "ar";
}
