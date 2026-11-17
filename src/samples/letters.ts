/**
 * SAMPLE LETTERS. Every person, organisation, place, address, phone number,
 * email address and reference number below is invented for this demo.
 * Any resemblance to real ones is accidental.
 */
export interface SampleLetter {
  id: string;
  title: string;
  kind: string;
  language: "en" | "de" | "es" | "fr";
  text: string;
  /** Strings that must never leave the device (used by tests and the self-check). */
  sensitive: string[];
}

export const RENT_NOTICE: SampleLetter = {
  id: "rent",
  title: "Rent increase notice",
  kind: "Housing",
  language: "en",
  text: `SAMPLE LETTER - invented for demonstration

Harrowgate Property Management
88 Quillon Avenue, Suite 400
Eastmere, OR 97999

March 2, 2026

Maria Elena Okafor
14 Larkspur Lane, Apt 3B
Eastmere, OR 97998

Tenant account: HPM-55120-3B

Dear Ms Okafor,

NOTICE OF RENT INCREASE

This letter is your formal notice that the monthly rent for your unit will increase from $1,450.00 to $1,595.00, starting May 1, 2026.

If you wish to stay in the unit at the new rent, you do not need to do anything. If you do not accept the new rent, you must give us written notice that you will move out by April 1, 2026. If we do not receive written notice by that date, we will treat your continued tenancy as acceptance of the new rent, and the higher amount will be due on May 1, 2026.

If you believe this increase is not allowed under your lease or local law, you may contact the Eastmere Tenant Help Line at (541) 555-0187 before April 1, 2026.

Questions about this notice can be sent to leasing@harrowgate-pm.example or by phone at (541) 555-0142.

Sincerely,

Jordan Reyes
Leasing Manager`,
  sensitive: ["Maria Elena Okafor", "Okafor", "14 Larkspur Lane, Apt 3B", "HPM-55120-3B", "Eastmere, OR 97998"],
};

export const SCHOOL_NOTICE: SampleLetter = {
  id: "school",
  title: "School attendance letter",
  kind: "School",
  language: "en",
  text: `SAMPLE LETTER - invented for demonstration

Wrenfield Primary School
Attendance Office

Date: 10 November 2026

Parent/Guardian of: Tomasz Novak
Student ID: WPS-200417
Class: 4B

Dear Mr Novak,

Our records show that Tomasz has had 9 unauthorised absences since the start of term. When unauthorised absences reach 10 sessions in a term, the school is required to refer the case to the local authority, which may issue a penalty notice of £80 per parent.

Please contact the Attendance Office to arrange a meeting by 24 November 2026. At the meeting we will discuss the reasons for the absences and agree a support plan. If you do not contact us by this date, the school may make the referral without a meeting.

You can reach the Attendance Office on 01632 960 418 or at attendance@wrenfield-primary.example.

Yours sincerely,

Priya Castellanos
Attendance Officer`,
  sensitive: ["Tomasz Novak", "Tomasz", "Novak", "WPS-200417"],
};

export const INSURANCE_DE: SampleLetter = {
  id: "insurance-de",
  title: "Insurance payment reminder (German)",
  kind: "Insurance",
  language: "de",
  text: `MUSTERBRIEF - nur zur Demonstration erfunden

Lindhaven Versicherung AG
Postfach 12 34 56
99999 Lindhaven

Frau
Amira Haddad
Kirschblütenweg 7
99998 Lindhaven

Versicherungsnummer: LV-7781-2204-K
Geburtsdatum: 14.06.1991

Lindhaven, 3. November 2026

Zahlungserinnerung – Hausratversicherung

Sehr geehrte Frau Haddad,

leider konnten wir den Beitrag für Ihre Hausratversicherung in Höhe von 64,20 EUR für den Monat Oktober nicht abbuchen, weil die Lastschrift zurückgegeben wurde.

Bitte überweisen Sie den offenen Betrag bis zum 17. November 2026 auf unser Konto. Geben Sie dabei Ihre Versicherungsnummer als Verwendungszweck an.

Wenn der Betrag bis zu diesem Datum nicht bei uns eingeht, ruht Ihr Versicherungsschutz ab dem 18. November 2026. Schäden, die danach entstehen, sind dann nicht versichert, bis der Beitrag vollständig bezahlt ist. Außerdem können wir Mahngebühren von 5,00 EUR berechnen.

Bei Fragen erreichen Sie uns unter 0999 123 4567 oder service@lindhaven-versicherung.example.

Mit freundlichen Grüßen

Ihre Lindhaven Versicherung`,
  sensitive: ["Amira Haddad", "Haddad", "Kirschblütenweg 7", "LV-7781-2204-K", "14.06.1991"],
};

/** Long letter: several pages, deliberately past the on-device context limit. */
export const BENEFIT_REVIEW: SampleLetter = {
  id: "benefit",
  title: "Benefit overpayment review (long, 6 pages)",
  kind: "Benefits",
  language: "en",
  text: buildBenefitLetter(),
  sensitive: ["Daniel Achterberg", "Achterberg", "27 Fernhollow Road", "NVB-3390-118-24", "QX 44 18 92 C", "07 March 1984"],
};

function buildBenefitLetter(): string {
  const head = `SAMPLE LETTER - invented for demonstration

Northvale Benefits Agency
Overpayment Recovery Unit
PO Box 4410
Northvale NV1 9ZZ

Mr Daniel Achterberg
27 Fernhollow Road
Northvale NV4 2QP

Case reference: NVB-3390-118-24
National Insurance number: QX 44 18 92 C
Date of birth: 07 March 1984

Date of this letter: 6 November 2026

Decision about your Housing Support payments

Dear Mr Achterberg,

We have looked again at your Housing Support claim for the period 1 January 2026 to 30 September 2026. We have decided that you were paid £2,316.40 more than you were entitled to. This is called an overpayment. This letter explains why, what you need to do, and what happens next.

You must tell us by 4 December 2026 whether you agree with this decision. If you think the decision is wrong, you can ask us to look at it again. This is called a mandatory reconsideration. You must ask for a mandatory reconsideration within one month of the date of this letter. If you do not contact us by 4 December 2026, we will start to recover the overpayment from your ongoing payments at a rate of £18.50 per week from 11 December 2026.
`;
  const sections = [
    "Why we made this decision",
    "How we worked out the amount",
    "Your earnings during the period",
    "Changes you told us about",
    "Changes you did not tell us about",
    "How the overpayment will be recovered",
    "If you cannot afford the repayments",
    "Your right to ask for a mandatory reconsideration",
    "Your right to appeal to an independent tribunal",
    "Getting independent advice",
    "How we use your information",
    "Paying back in full or in part",
  ];
  const para = (title: string, i: number) =>
    `\n${i + 1}. ${title}\n\n` +
    `In this part of the letter we explain ${title.toLowerCase()}. Between 1 January 2026 and 30 September 2026 your Housing Support was calculated each assessment period using the earnings information we held at the time, the rent figure on your claim, and the number of people in your household. When information changes, the amount you are entitled to can change too. We compared the payments we made with the payments you should have received once all of the information was taken into account, period by period. ` +
    `For assessment period ${i + 1}, the difference was recorded on your account and is included in the total shown at the start of this letter. You can ask us for a full breakdown at any time, and we will send it to you in writing. If any of the figures we used are wrong, please tell us as soon as possible and send evidence, such as payslips, bank statements or a letter from your employer. Evidence received after 4 December 2026 may still be considered, but recovery will normally continue while we look at it. ` +
    `Repeated text for length: the rules that apply to this part are set out in the Housing Support regulations, and our staff follow published guidance when they apply them. If you need this letter in another format, such as large print, braille, audio or another language, please ask and we will arrange it at no cost to you.\n`;
  const tail = `
What to do now

Please contact the Overpayment Recovery Unit by 4 December 2026 on 0300 555 0199, Monday to Friday, 8am to 6pm, quoting your case reference. You can also write to us at the address at the top of this letter. If you are not sure what to do, an independent advice service can help you for free.

Yours sincerely,

Overpayment Recovery Unit
Northvale Benefits Agency`;
  let body = head;
  sections.forEach((t, i) => (body += para(t, i)));
  sections.forEach((t, i) => (body += para(`${t} (continued)`, i + sections.length)));
  return body + tail;
}

export const SAMPLES: SampleLetter[] = [RENT_NOTICE, INSURANCE_DE, SCHOOL_NOTICE, BENEFIT_REVIEW];
