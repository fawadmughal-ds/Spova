import { BadgeDollarSign, BookOpenText, CandlestickChart, CircleHelp, Landmark, LogIn, Scale, Wallet, WalletCards, type LucideIcon } from 'lucide-react';

/**
 * FAQ content, grouped by topic. Answers describe how this platform works today.
 * `pending` marks anything the client still has to decide; it is shown as a visible placeholder under the answer.
 */
export interface FaqItem {
  q: string;
  a: string;
  pending?: string;
  link?: { href: string; label: string };
}

export interface FaqTopic {
  id: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
  items: FaqItem[];
}

export const FAQ_TOPICS: FaqTopic[] = [
  {
    id: 'getting-started',
    label: 'Trading with us',
    blurb: 'Opening an account and finding your way around',
    icon: LogIn,
    items: [
      {
        q: 'How do I open an account?',
        a: 'Fill in the registration form with your name, email, phone number, date of birth and country, choose a password and accept the agreements. It takes about two minutes and your demo account is created the moment you finish.',
        link: { href: '/register', label: 'Open an account' },
      },
      { q: 'Does it cost anything to register?', a: 'No. Registering and opening a demo account are free, and you do not need a card to do it.' },
      {
        q: 'How do I verify my account?',
        a: 'Upload two documents from the Documents section of your client area: a proof of identity (passport, national ID card or driving licence) and a proof of residence (a recent utility bill or bank statement). The back office reviews them and you can follow the status from your dashboard.',
      },
      {
        q: 'How soon can I start trading?',
        a: 'On a demo account, straight after registration. To trade a live account you first complete verification, then open the live account and fund it.',
      },
      {
        q: 'How do I log in?',
        a: 'Use the Log in button at the top of any page and enter the email and password you registered with. You land in your client area, where your accounts, statements and the web terminal are one click away.',
        link: { href: '/login', label: 'Log in' },
      },
      {
        q: 'I forgot my password. What now?',
        a: 'Choose "Forgot password?" on the login page and enter your email. If an account exists for it, we send a reset link that is valid for one hour.',
        link: { href: '/forgot-password', label: 'Reset your password' },
      },
      {
        q: 'How do I change my password?',
        a: 'Open Profile in the client area, go to the Password tab, enter your current password and choose a new one. For your safety, other devices are signed out when the password changes.',
      },
      {
        q: 'How do I update my personal details?',
        a: 'Name, phone, date of birth, country and address can be edited under Profile in the client area. Your email address cannot be changed there; contact support if you need it updated.',
      },
      {
        q: 'Where can I see my balance?',
        a: 'Your dashboard shows balance, equity, free margin and margin level for the selected account, and the figures update live while you are connected.',
      },
      {
        q: 'Where can I see past deposits, withdrawals and adjustments?',
        a: 'Every account has a statement that lists each movement with its date, type, reason, amount and the balance after it. Open Trading accounts in the client area and choose Statement.',
      },
    ],
  },
  {
    id: 'trading-account',
    label: 'Trading account',
    blurb: 'Tiers, demo accounts and leverage',
    icon: WalletCards,
    items: [
      {
        q: 'Which account types do you offer?',
        a: 'Five tiers on one platform: Classic, Silver, Gold, Platinum and VIP. All of them trade the same instruments and include negative balance protection; higher tiers add spread discounts and more personal service.',
        link: { href: '/trading-account', label: 'Compare accounts' },
      },
      {
        q: 'How is my tier decided?',
        a: 'The tier is assigned by the broker based on your net deposits. Demo accounts always use Classic conditions.',
      },
      {
        q: 'What is the difference between a demo and a live account?',
        a: 'They share the same terminal, instruments and margin rules, so what you practise is what you trade. A demo account uses virtual funds and cannot be withdrawn from; a live account holds real money and requires verification.',
      },
      {
        q: 'How do I create a demo account?',
        a: 'One is created automatically when you register. You can add more from Trading accounts in the client area, up to three demo accounts in total.',
      },
      { q: 'Does the demo account come with funds?', a: 'Yes. Each demo account starts with $10,000 in virtual funds.' },
      {
        q: 'How many accounts can I hold?',
        a: 'Up to three demo accounts and one live account per client.',
      },
      {
        q: 'What leverage is available?',
        a: 'The maximum depends on the asset class: up to 1:400 on forex, 1:200 on indices and metals, 1:100 on commodities and 1:5 on shares and crypto. Your account also has its own leverage setting, and the lower of the two applies to each trade.',
        link: { href: '/cfds-list', label: 'See the CFD list' },
      },
      {
        q: 'In which currency are accounts held?',
        a: 'Accounts are denominated in US dollars.',
        pending: '[PLACEHOLDER - confirm whether other account currencies will be offered]',
      },
    ],
  },
  {
    id: 'deposits',
    label: 'Deposits',
    blurb: 'Funding your live account',
    icon: Wallet,
    items: [
      { q: 'What is the minimum deposit?', a: 'The minimum first deposit is $200, which opens a Classic account.' },
      {
        q: 'How do I make a deposit?',
        a: 'Submit a deposit request from the Deposit / Withdraw section of your client area. Once the back office approves it, the amount is posted to your account and appears on your statement.',
      },
      {
        q: 'Which payment methods can I use?',
        a: 'The list of available payment methods will be shown on the deposit screen and in the General Fees document.',
        pending: '[PLACEHOLDER - payment methods to be confirmed by the client]',
      },
      {
        q: 'Can I open an account without depositing?',
        a: 'Yes. You can register and trade a demo account for as long as you like without making a deposit.',
      },
      {
        q: 'My payment was declined. What should I do?',
        a: 'Check that the details you entered are correct and that your bank or card issuer allows the payment, then try again. If it is still declined, contact support with the time and amount of the attempt so we can look into it.',
        link: { href: '/contact-us', label: 'Contact support' },
      },
      {
        q: 'Can I deposit from, or send funds to, someone else\'s account?',
        a: 'Rules on third-party payments are set out in the AML & CFT Policy.',
        pending: '[PLACEHOLDER - third-party payment policy to be confirmed by compliance]',
        link: { href: '/legal', label: 'Legal documents' },
      },
    ],
  },
  {
    id: 'withdrawals',
    label: 'Withdrawals',
    blurb: 'Getting your money out',
    icon: Landmark,
    items: [
      {
        q: 'How do I request a withdrawal?',
        a: 'Submit a withdrawal request from the Deposit / Withdraw section of your client area. Withdrawals are available on live accounts once your identity and address are verified.',
      },
      {
        q: 'How long does a withdrawal take?',
        a: 'Requests are reviewed within one business day. After approval, a bank transfer may take two to five days to arrive.',
      },
      {
        q: 'How do I check the status of my request?',
        a: 'Your payment history in the client area lists each request with its current status. When a withdrawal is approved, it also appears on your account statement.',
      },
      { q: 'Can I withdraw from a demo account?', a: 'No. Demo balances are virtual, so there is nothing to pay out.' },
      {
        q: 'Can I withdraw while I have open positions?',
        a: 'A withdrawal reduces your balance and therefore your free margin and margin level. Make sure the remaining equity comfortably covers your open positions before you request one.',
        pending: '[PLACEHOLDER - rule for withdrawals with open positions to be confirmed]',
      },
      {
        q: 'Why would a withdrawal be declined?',
        a: 'The most common reasons are incomplete verification, details that do not match your account, or insufficient free margin. If a request is declined, the back office records a reason and support can walk you through it.',
      },
      {
        q: 'Is there a minimum withdrawal amount?',
        a: 'Minimum amounts per payment method will be listed in the General Fees document.',
        pending: '[PLACEHOLDER - minimum withdrawal amounts to be confirmed]',
      },
    ],
  },
  {
    id: 'fees',
    label: 'Fees',
    blurb: 'Spreads, swaps and other costs',
    icon: BadgeDollarSign,
    items: [
      {
        q: 'How do you charge for trading?',
        a: 'The main cost of a trade is the spread, the difference between the buy and the sell price. Spreads start from 0.0 pips, and Silver to VIP accounts receive a discount of 10% to 40% on them.',
        link: { href: '/trading-account', label: 'Spread discounts by tier' },
      },
      {
        q: 'What are swap fees?',
        a: 'A swap is the overnight financing adjustment applied to a position that stays open past the daily rollover. It can be a charge or a credit and differs for long and short positions on each instrument.',
        link: { href: '/swap-fees', label: 'Swap fees by instrument' },
      },
      {
        q: 'Are there deposit or withdrawal fees?',
        a: 'Any charges on deposits and withdrawals will be published in the General Fees document.',
        pending: '[PLACEHOLDER - deposit and withdrawal fees to be confirmed]',
      },
      {
        q: 'Is there an inactivity fee?',
        a: 'Any inactivity charge will be published in the General Fees document.',
        pending: '[PLACEHOLDER - inactivity fee policy to be confirmed]',
      },
      {
        q: 'Do you charge commission?',
        a: 'Any commission that applies in addition to the spread will be published in the General Fees document.',
        pending: '[PLACEHOLDER - commission schedule to be confirmed]',
      },
    ],
  },
  {
    id: 'legal-compliance',
    label: 'Legal & compliance',
    blurb: 'Regulation, protection and your data',
    icon: Scale,
    items: [
      {
        q: 'Are you regulated?',
        a: 'Zerventa is an online CFD broker offering forex, indices, commodities, shares, crypto and metals. CFDs are complex, leveraged products that can lose money rapidly, and the service is available only where local law permits trading.',
        pending: '[PLACEHOLDER - regulator, licence and entity details to be supplied by the client]',
      },
      {
        q: 'Are client funds protected?',
        a: 'Every account type includes negative balance protection, so you cannot lose more than your account balance.',
        pending: '[PLACEHOLDER - segregated funds wording to be confirmed]',
      },
      {
        q: 'Is my personal information safe?',
        a: 'Your session is kept in secure, httpOnly cookies that scripts cannot read, verification documents are held in private storage, and every back-office action on an account is written to an audit log.',
        link: { href: '/cookies-privacy', label: 'Cookies & privacy' },
      },
      {
        q: 'Is there a minimum age?',
        a: 'You must be an adult to open an account, and we ask for your date of birth at registration. The exact age requirement is set out in the Client Agreement.',
        pending: '[PLACEHOLDER - minimum age by jurisdiction to be confirmed]',
      },
      {
        q: 'Which countries do you accept clients from?',
        a: 'We do not offer services to residents of certain jurisdictions, where CFD trading is restricted.',
        pending: '[PLACEHOLDER - full list of restricted jurisdictions]',
      },
      {
        q: 'How do I make a complaint?',
        a: 'Talk to support first; most issues are solved there. If you are not satisfied, you can raise a formal complaint and it will be investigated and answered in writing.',
        link: { href: '/complaints', label: 'Complaints procedure' },
      },
    ],
  },
  {
    id: 'trading',
    label: 'Trading',
    blurb: 'Orders, margin and the platform',
    icon: CandlestickChart,
    items: [
      {
        q: 'What can I trade?',
        a: 'CFDs across six asset classes: forex, indices, commodities, shares, crypto and metals, all from the same account.',
        link: { href: '/cfds-list', label: 'Full CFD list' },
      },
      {
        q: 'Which order types are available?',
        a: 'Market orders, which fill at the live bid or ask, and pending limit and stop orders, which wait for your price. You can attach a stop loss and a take profit to any of them.',
        link: { href: '/platform', label: 'About the platform' },
      },
      {
        q: 'What happens at a margin call and at stop-out?',
        a: 'When your margin level falls to 100% you receive a margin call notice. If it reaches 20%, the platform starts closing positions, beginning with the one losing the most, until the level is back above the stop-out threshold.',
      },
      {
        q: 'Can I lose more than I deposit?',
        a: 'No. Negative balance protection applies to every account type, so your loss is limited to your account balance.',
      },
      {
        q: 'Why can I not trade some markets at the weekend?',
        a: 'Each market follows the hours of its underlying venue. Forex trades from Sunday evening to Friday evening (UTC), shares and indices trade during exchange hours on weekdays, and crypto is open every day.',
        link: { href: '/market-holidays', label: 'Trading hours and holidays' },
      },
      {
        q: 'What do I need to run the platform?',
        a: 'A current web browser and a stable internet connection. The terminal runs in the browser on desktop, tablet and phone, with nothing to download.',
      },
      {
        q: 'What should I do if the platform is not behaving as expected?',
        a: 'Reload the page and check your connection first. If the problem continues, contact support with the time, the instrument and what you were trying to do.',
        link: { href: '/contact-us', label: 'Contact support' },
      },
      {
        q: 'Where can I see my trading history?',
        a: 'Closed trades and their results are posted to your account statement, alongside deposits, withdrawals and adjustments.',
      },
    ],
  },
  {
    id: 'education',
    label: 'Trading education',
    blurb: 'The vocabulary, explained simply',
    icon: BookOpenText,
    items: [
      {
        q: 'What is a CFD?',
        a: 'A contract for difference lets you trade the price movement of a market without owning the underlying asset. Your profit or loss is the difference between the price at which you open the position and the price at which you close it, multiplied by your position size.',
        link: { href: '/trading-education', label: 'Trading education' },
      },
      {
        q: 'What do "going long" and "going short" mean?',
        a: 'Going long means buying because you expect the price to rise. Going short means selling because you expect it to fall. With CFDs you can do either.',
      },
      {
        q: 'What is leverage?',
        a: 'Leverage lets you open a position larger than the money you put up. At 1:100, a $1,000 margin controls a $100,000 position. It magnifies gains and losses alike, which is why position size matters more than anything else.',
      },
      {
        q: 'What is margin?',
        a: 'Margin is the part of your equity set aside to keep a position open. It is calculated as lots × contract size × price ÷ leverage. What is left over is your free margin.',
        link: { href: '/trading-education', label: 'Trading education' },
      },
      {
        q: 'What is a pip?',
        a: 'A pip is the standard unit for quoting a change in a currency pair: 0.0001 for most pairs and 0.01 for pairs quoted in Japanese yen. If EURUSD moves from 1.0840 to 1.0855 it has risen 15 pips.',
      },
      {
        q: 'What is the spread?',
        a: 'The spread is the gap between the bid (sell) price and the ask (buy) price. A position starts slightly negative by the size of the spread, so the market has to move in your favour by that amount before you break even.',
      },
      {
        q: 'What is slippage?',
        a: 'Slippage is the difference between the price you expected and the price at which an order is actually filled. It tends to appear in fast markets, around news releases and when a market reopens with a gap.',
      },
      {
        q: 'What is a stop loss?',
        a: 'A stop loss is an instruction to close a position automatically if the price moves against you to a level you choose. It caps the loss on a trade without you having to watch the screen.',
        link: { href: '/risk-management-tools', label: 'Risk management tools' },
      },
      {
        q: 'What is a take profit?',
        a: 'A take profit closes a position automatically once the price reaches your target, locking in the gain.',
      },
      {
        q: 'What is the difference between a market order and a limit order?',
        a: 'A market order is filled immediately at the best available price. A limit order waits until the market reaches the price you set, so you control the price but not whether it fills.',
      },
    ],
  },
  {
    id: 'general',
    label: 'General',
    blurb: 'Everything else',
    icon: CircleHelp,
    items: [
      {
        q: 'Can I trade without previous experience?',
        a: 'You can, but start on the demo account. It uses the same terminal and rules as a live account, so you can learn how orders, margin and stops behave before any real money is involved.',
        link: { href: '/education', label: 'Education center' },
      },
      {
        q: 'Is trading risky?',
        a: 'Yes. CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. Only trade with money you can afford to lose and make sure you understand how CFDs work.',
      },
      {
        q: 'How do I control which notifications I receive?',
        a: 'Under Profile, in the Settings tab, you can switch email, SMS, push and phone-call notifications on or off individually.',
      },
      {
        q: 'How do I contact support?',
        a: 'Live chat is available 24/5 from the client area, and you can also reach us by email.',
        link: { href: '/contact-us', label: 'Contact us' },
      },
      {
        q: 'Do you have a partner programme?',
        a: 'Yes. Affiliates can refer new clients to the platform; the partner page explains how the programme works.',
        link: { href: '/become-a-partner', label: 'Become a partner' },
      },
    ],
  },
];

export const FAQ_COUNT = FAQ_TOPICS.reduce((n, t) => n + t.items.length, 0);

/** Stable anchor for a question: "What is a pip?" -> "what-is-a-pip" */
export const faqSlug = (q: string) =>
  q
    .toLowerCase()
    .replace(/["'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
