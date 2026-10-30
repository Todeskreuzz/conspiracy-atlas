// Second batch of case files for The Conspiracy Atlas (same shapes and editorial rules as data/seed.mjs).
//
// - Historical facts and further claims are kept separate (claims carry their own evidence status).
// - Only real, verifiable publications are cited. No invented documents, quotes or connections.
// - URLs were not machine-verified when this file was written. Run `npm run check-sources`.
//
// Keys may refer to entries of data/seed.mjs (e.g. 'cia', 'church-committee', 'aaro-2024').
// Migration: node scripts/generate-addition.mjs data/cases-2.mjs migrations/d1/0005_more_cases.sql

export const locations = [
  { key: 'tuskegee', name: 'Tuskegee, Alabama', country: 'US', lat: 32.4302, lng: -85.7077, kind: 'city', description: 'Town in Macon County, Alabama, where the Public Health Service syphilis study was based.' },
  { key: 'media-pa', name: 'Media, Pennsylvania', country: 'US', lat: 39.9168, lng: -75.3877, kind: 'city', description: 'Town near Philadelphia; site of the 1971 burglary of an FBI field office.' },
  { key: 'gulf-of-tonkin', name: 'Gulf of Tonkin', country: 'VN', lat: 19.5, lng: 107.5, kind: 'region', description: 'Gulf of the South China Sea off the coasts of northern Vietnam and southern China.' },
  { key: 'huntsville', name: 'Huntsville, Alabama', country: 'US', lat: 34.7304, lng: -86.5861, kind: 'city', description: "Home of the U.S. Army's Redstone Arsenal and NASA's Marshall Space Flight Center." },
  { key: 'roswell', name: 'Roswell, New Mexico', country: 'US', lat: 33.3943, lng: -104.523, kind: 'city', description: 'City in New Mexico; site of Roswell Army Air Field in 1947.' },
  { key: 'reichstag', name: 'Reichstag building, Berlin', country: 'DE', lat: 52.5186, lng: 13.3762, kind: 'site', description: 'Seat of the German parliament; badly damaged by fire on 27 February 1933.' },
  { key: 'leipzig', name: 'Leipzig, Saxony', country: 'DE', lat: 51.3397, lng: 12.3731, kind: 'city', description: 'Seat of the Reichsgericht, the supreme court of the German Reich.' },
];

export const organizations = [
  { key: 'phs', name: 'U.S. Public Health Service', kind: 'agency', founded: '1798', country: 'US', location: 'washington', description: 'Federal public health agency of the United States; ran the Tuskegee syphilis study.' },
  { key: 'fbi', name: 'Federal Bureau of Investigation (FBI)', kind: 'agency', founded: '1908', country: 'US', location: 'washington', description: 'Domestic intelligence and federal law enforcement agency of the United States.' },
  { key: 'citizens-commission', name: 'Citizens’ Commission to Investigate the FBI', kind: 'group', founded: '1971', country: 'US', location: 'media-pa', description: 'Group of activists who broke into the FBI field office in Media, Pennsylvania, in March 1971 and passed the documents to newspapers.' },
  { key: 'nsa', name: 'National Security Agency (NSA)', kind: 'agency', founded: '1952', country: 'US', location: null, description: 'U.S. signals intelligence agency.' },
  { key: 'jioa', name: 'Joint Intelligence Objectives Agency', kind: 'agency', founded: '1945', country: 'US', location: 'washington', description: 'U.S. agency that administered Operation Paperclip.' },
  { key: 'reichsgericht', name: 'Reichsgericht', kind: 'institution', founded: '1879', country: 'DE', location: 'leipzig', description: 'Supreme court of the German Reich; tried the Reichstag fire case in 1933.' },
];

export const people = [
  { key: 'hoover', name: 'J. Edgar Hoover', role: 'FBI Director (1924–1972)', born: '1895', died: '1972', description: 'Directed the FBI during the COINTELPRO programs and ordered their end in April 1971.' },
  { key: 'mlk', name: 'Martin Luther King Jr.', role: 'Civil rights leader', born: '1929', died: '1968', description: 'Target of FBI surveillance and of an anonymous FBI letter sent to him in 1964.' },
  { key: 'lbj', name: 'Lyndon B. Johnson', role: '36th President of the United States', born: '1908', died: '1973', description: 'Ordered retaliatory air strikes after the reported Gulf of Tonkin attacks and asked Congress for the Tonkin Gulf Resolution.' },
  { key: 'von-braun', name: 'Wernher von Braun', role: 'Rocket engineer', born: '1912', died: '1977', description: 'Technical director of the German V-2 program and member of the SS; brought to the United States in 1945, later led the Saturn V development at NASA.' },
  { key: 'rudolph', name: 'Arthur Rudolph', role: 'Rocket engineer', born: '1906', died: '1996', description: 'Paperclip engineer and Saturn V project manager; left the United States in 1984 after an investigation into his role at the Mittelwerk forced-labour factory.' },
  { key: 'van-der-lubbe', name: 'Marinus van der Lubbe', role: 'Dutch council communist', born: '1909', died: '1934', description: 'Arrested inside the burning Reichstag on 27 February 1933, sentenced to death and executed in January 1934.' },
  { key: 'dimitrov', name: 'Georgi Dimitrov', role: 'Bulgarian communist', born: '1882', died: '1949', description: 'Co-defendant in the Reichstag fire trial; acquitted in December 1933.' },
];

export const sources = [
  // Tuskegee
  { key: 'cdc-tuskegee', title: 'The U.S. Public Health Service Untreated Syphilis Study at Tuskegee', author: null, publisher: 'U.S. Centers for Disease Control and Prevention', date: null, type: 'website', primary: false, url: 'https://www.cdc.gov/tuskegee/', quality: 'Official account by the successor agency, with timeline and background.' },
  { key: 'tuskegee-panel', title: 'Final Report of the Tuskegee Syphilis Study Ad Hoc Advisory Panel', author: 'Tuskegee Syphilis Study Ad Hoc Advisory Panel', publisher: 'U.S. Department of Health, Education, and Welfare', date: '1973', type: 'government_report', primary: true, url: null, quality: 'Official review commissioned after the study became public.' },
  { key: 'jones-bad-blood', title: 'Bad Blood: The Tuskegee Syphilis Experiment', author: 'James H. Jones', publisher: 'Free Press', date: '1981', type: 'book', primary: false, url: null, quality: 'Standard historical account based on Public Health Service records.' },
  { key: 'reverby-tuskegee', title: 'Examining Tuskegee: The Infamous Syphilis Study and Its Legacy', author: 'Susan M. Reverby', publisher: 'University of North Carolina Press', date: '2009', type: 'book', primary: false, url: null, quality: 'Academic history; also discusses the persistent belief that the men were infected deliberately.' },
  { key: 'ethically-impossible', title: 'Ethically Impossible: STD Research in Guatemala from 1946 to 1948', author: 'Presidential Commission for the Study of Bioethical Issues', publisher: 'Presidential Commission for the Study of Bioethical Issues', date: '2011-09', type: 'government_report', primary: true, url: null, quality: 'Official investigation of separate Public Health Service experiments in which people were deliberately infected.' },
  { key: 'belmont', title: 'The Belmont Report: Ethical Principles and Guidelines for the Protection of Human Subjects of Research', author: 'National Commission for the Protection of Human Subjects of Biomedical and Behavioral Research', publisher: 'U.S. Department of Health, Education, and Welfare', date: '1979-04-18', type: 'government_report', primary: true, url: 'https://www.hhs.gov/ohrp/regulations-and-policy/belmont-report/index.html', quality: 'Founding document of U.S. research ethics rules, written in response to abuses such as the Tuskegee study.' },
  // COINTELPRO
  { key: 'church-book3', title: 'Supplementary Detailed Staff Reports on Intelligence Activities and the Rights of Americans, Book III', author: 'U.S. Senate (Church Committee)', publisher: 'U.S. Government Printing Office', date: '1976-04-23', type: 'government_report', primary: true, url: 'https://www.senate.gov/about/powers-procedures/investigations/church-committee.htm', quality: 'Official committee report with a detailed chapter on COINTELPRO. The URL leads to the Senate overview page of the committee.' },
  { key: 'fbi-vault-cointelpro', title: 'COINTELPRO (FBI Records: The Vault)', author: null, publisher: 'Federal Bureau of Investigation', date: null, type: 'archive_collection', primary: true, url: 'https://vault.fbi.gov/cointel-pro', quality: 'Released FBI files on the programs, published by the FBI itself.' },
  { key: 'medsger', title: "The Burglary: The Discovery of J. Edgar Hoover's Secret FBI", author: 'Betty Medsger', publisher: 'Alfred A. Knopf', date: '2014', type: 'book', primary: false, url: null, quality: 'Account of the 1971 Media burglary by the journalist who first reported on the stolen files.' },
  { key: 'gage-mlk', title: 'What an Uncensored Letter to M.L.K. Reveals', author: 'Beverly Gage', publisher: 'The New York Times Magazine', date: '2014-11-11', type: 'news_article', primary: false, url: null, quality: 'Historian’s publication of the full anonymous FBI letter found in the National Archives.' },
  // Gulf of Tonkin
  { key: 'hanyok', title: 'Skunks, Bogies, Silent Hounds, and the Flying Fish: The Gulf of Tonkin Mystery, 2–4 August 1964', author: 'Robert J. Hanyok', publisher: 'Cryptologic Quarterly (National Security Agency)', date: '2001', type: 'government_report', primary: true, url: null, quality: 'Internal NSA history, declassified in 2005. Concludes that no attack took place on 4 August 1964.' },
  { key: 'tonkin-resolution', title: 'Tonkin Gulf Resolution (1964)', author: 'U.S. Congress', publisher: 'U.S. National Archives (Milestone Documents)', date: '1964-08-07', type: 'primary_document', primary: true, url: 'https://www.archives.gov/milestone-documents/tonkin-gulf-resolution', quality: 'Text of the joint resolution with archival context.' },
  { key: 'moise', title: 'Tonkin Gulf and the Escalation of the Vietnam War', author: 'Edwin E. Moïse', publisher: 'University of North Carolina Press', date: '1996', type: 'book', primary: false, url: null, quality: 'Detailed academic study of both incidents, including interviews with American and Vietnamese participants.' },
  // Operation Paperclip
  { key: 'jacobsen-paperclip', title: 'Operation Paperclip: The Secret Intelligence Program that Brought Nazi Scientists to America', author: 'Annie Jacobsen', publisher: 'Little, Brown and Company', date: '2014', type: 'book', primary: false, url: null, quality: 'Popular history based on declassified records.' },
  { key: 'hunt-secret-agenda', title: 'Secret Agenda: The United States Government, Nazi Scientists, and Project Paperclip, 1945 to 1990', author: 'Linda Hunt', publisher: "St. Martin's Press", date: '1991', type: 'book', primary: false, url: null, quality: 'Investigative account based on records obtained under the Freedom of Information Act.' },
  { key: 'neufeld-von-braun', title: 'Von Braun: Dreamer of Space, Engineer of War', author: 'Michael J. Neufeld', publisher: 'Alfred A. Knopf', date: '2007', type: 'book', primary: false, url: null, quality: 'Scholarly biography by a curator of the Smithsonian National Air and Space Museum.' },
  // Roswell
  { key: 'usaf-roswell-1995', title: 'The Roswell Report: Fact vs. Fiction in the New Mexico Desert', author: 'Headquarters, United States Air Force', publisher: 'U.S. Government Printing Office', date: '1995', type: 'government_report', primary: true, url: null, quality: 'Official Air Force report. Identifies the 1947 debris as part of a Project Mogul balloon train.' },
  { key: 'usaf-roswell-1997', title: 'The Roswell Report: Case Closed', author: 'James McAndrew', publisher: 'Headquarters, United States Air Force', date: '1997', type: 'government_report', primary: true, url: null, quality: 'Official follow-up report on the later accounts of alien bodies.' },
  { key: 'gao-roswell', title: 'Results of a Search for Records Concerning the 1947 Crash Near Roswell, New Mexico (GAO/NSIAD-95-187)', author: 'U.S. General Accounting Office', publisher: 'U.S. General Accounting Office', date: '1995-07-28', type: 'government_report', primary: true, url: null, quality: 'Congressional audit of the available government records.' },
  { key: 'berlitz-moore', title: 'The Roswell Incident', author: 'Charles Berlitz; William L. Moore', publisher: 'Grosset & Dunlap', date: '1980', type: 'book', primary: true, url: null, quality: 'Origin of the modern crash narrative. A primary source for the history of the theory, not evidence for it.' },
  // Reichstag fire
  { key: 'hett-reichstag', title: "Burning the Reichstag: An Investigation into the Third Reich's Enduring Mystery", author: 'Benjamin Carter Hett', publisher: 'Oxford University Press', date: '2014', type: 'book', primary: false, url: null, quality: 'Academic study that argues for Nazi involvement; its conclusions are debated.' },
  { key: 'tobias-reichstag', title: 'Der Reichstagsbrand: Legende und Wirklichkeit', author: 'Fritz Tobias', publisher: 'Grote', date: '1962', type: 'book', primary: false, url: null, quality: 'Influential study that argues van der Lubbe acted alone; its conclusions are debated.' },
  { key: 'reichstag-decree', title: 'Verordnung des Reichspräsidenten zum Schutz von Volk und Staat (28 February 1933)', author: 'Reichspräsident Paul von Hindenburg', publisher: 'Reichsgesetzblatt 1933 I, p. 83', date: '1933-02-28', type: 'primary_document', primary: true, url: null, quality: 'The Reichstag Fire Decree as published in the official law gazette.' },
  { key: 'brown-book', title: 'The Brown Book of the Hitler Terror and the Burning of the Reichstag', author: 'World Committee for the Victims of German Fascism', publisher: 'Victor Gollancz (English edition)', date: '1933', type: 'book', primary: true, url: null, quality: 'Communist counter-publication that first accused the Nazis. A primary source for the history of the claim, not proof of it.' },
];

// claim: [text, status, [sourceKeys], counterArgument?, [counterSourceKeys]]
export const theories = [
  {
    key: 'tuskegee',
    slug: 'tuskegee-syphilis-study',
    title: 'Tuskegee Syphilis Study',
    subtitle: 'Forty years of withheld treatment by the U.S. Public Health Service',
    category: 'science-technology',
    status: 'historically_documented',
    tags: ['Human experimentation', 'Public health', 'Civil rights', 'Medical ethics'],
    image: '/media/theories/tuskegee-syphilis-study.jpg',
    imageCredit: 'Doctor drawing blood from a participant of the Tuskegee syphilis study – National Archives at Atlanta (U.S. government), Public domain, via Wikimedia Commons https://commons.wikimedia.org/wiki/File:Tuskegee-syphilis-study_doctor-injecting-subject.jpg',
    summary:
      'From 1932 to 1972 the U.S. Public Health Service observed the course of untreated syphilis in Black men in Macon County, Alabama. The men were not told their diagnosis and were not treated, even after penicillin became the standard cure. The study ended after it was exposed by the press in 1972.',
    background:
      'About 600 men took part: roughly 400 with syphilis and about 200 without as a control group. They were told they were being treated for "bad blood" and received free meals, examinations and burial insurance. Researchers worked to keep them from receiving treatment elsewhere.',
    origin:
      'A Public Health Service employee, Peter Buxtun, raised objections internally from 1966. In July 1972 the Associated Press reporter Jean Heller made the study public. An advisory panel declared it ethically unjustified, and in 1997 President Bill Clinton formally apologised to the survivors.',
    claims: [
      ['The Public Health Service observed untreated syphilis in about 600 Black men in Alabama from 1932 to 1972 without their informed consent.', 'historically_documented', ['cdc-tuskegee', 'tuskegee-panel', 'jones-bad-blood']],
      ['Treatment was withheld even after penicillin became the standard cure for syphilis in the 1940s.', 'historically_documented', ['cdc-tuskegee', 'jones-bad-blood']],
      ['The scandal led to new rules for research on human subjects, including the National Research Act of 1974 and the Belmont Report of 1979.', 'historically_documented', ['belmont', 'cdc-tuskegee']],
      ['The men in the Tuskegee study were deliberately infected with syphilis.', 'debunked', ['reverby-tuskegee'], 'The men already had syphilis when they were enrolled. Deliberate infection did happen in separate Public Health Service experiments in Guatemala from 1946 to 1948.', ['jones-bad-blood', 'ethically-impossible']],
    ],
    general: [['reverby-tuskegee', 'context', null]],
    de: {
      title: 'Tuskegee-Syphilis-Studie',
      subtitle: 'Vierzig Jahre vorenthaltene Behandlung durch den US-Gesundheitsdienst',
      summary:
        'Von 1932 bis 1972 beobachtete der US Public Health Service den Verlauf unbehandelter Syphilis bei schwarzen Männern im Macon County, Alabama. Die Männer erfuhren ihre Diagnose nicht und wurden nicht behandelt, auch nicht, als Penicillin zur Standardtherapie geworden war. Die Studie endete, nachdem die Presse sie 1972 öffentlich gemacht hatte.',
      background:
        'Etwa 600 Männer nahmen teil: rund 400 mit Syphilis und etwa 200 ohne als Kontrollgruppe. Man sagte ihnen, sie würden wegen „bad blood“ behandelt, und gab ihnen kostenlose Mahlzeiten, Untersuchungen und eine Bestattungsversicherung. Die Forscher sorgten dafür, dass sie auch anderswo keine Behandlung bekamen.',
      claims: [
        'Der Public Health Service beobachtete von 1932 bis 1972 unbehandelte Syphilis bei etwa 600 schwarzen Männern in Alabama, ohne deren informierte Einwilligung.',
        'Die Behandlung wurde auch dann noch vorenthalten, als Penicillin in den 1940er-Jahren zur Standardtherapie gegen Syphilis wurde.',
        'Der Skandal führte zu neuen Regeln für Forschung am Menschen, darunter der National Research Act von 1974 und der Belmont-Bericht von 1979.',
        'Die Männer der Tuskegee-Studie seien absichtlich mit Syphilis infiziert worden.',
      ],
      counters: [
        'Die Männer hatten Syphilis bereits, als sie in die Studie aufgenommen wurden. Absichtliche Infektionen gab es in getrennten Experimenten des Public Health Service in Guatemala von 1946 bis 1948.',
      ],
    },
  },
  {
    key: 'cointelpro',
    slug: 'cointelpro',
    title: 'COINTELPRO',
    subtitle: "The FBI's secret programs against domestic political groups",
    category: 'intelligence-agencies',
    status: 'historically_documented',
    tags: ['FBI', 'Surveillance', 'Civil rights', 'Cold War'],
    image: '/media/theories/cointelpro.jpg',
    imageCredit: 'FBI COINTELPRO document on "neutralizing" the actress Jean Seberg – Richard W. Held / FBI, Public domain, via Wikimedia Commons https://commons.wikimedia.org/wiki/File:COINTELPRO_-_Jean_Seberg.jpg',
    summary:
      'From 1956 to 1971 the FBI ran a series of counterintelligence programs, known as COINTELPRO, to surveil, infiltrate, discredit and disrupt political organisations inside the United States. The programs became public after activists stole files from an FBI office in 1971 and were documented in detail by the Church Committee.',
    background:
      'The first program, begun in 1956, targeted the Communist Party USA. Later programs were aimed at the Socialist Workers Party, white supremacist groups, Black nationalist and civil rights organisations, and the New Left. Methods included anonymous letters, planted press stories, informants and attempts to provoke conflict between groups.',
    origin:
      'On 8 March 1971 a group calling itself the Citizens’ Commission to Investigate the FBI broke into the FBI field office in Media, Pennsylvania, and sent the files to newspapers. One file carried the label "COINTELPRO". Director J. Edgar Hoover ended the programs in April 1971. The Church Committee published a detailed account in 1976.',
    claims: [
      ['The FBI ran counterintelligence programs from 1956 to 1971 to surveil, infiltrate, discredit and disrupt domestic political organisations.', 'historically_documented', ['church-book3', 'fbi-vault-cointelpro']],
      ['The programs became public after files were stolen from the FBI field office in Media, Pennsylvania, in March 1971.', 'historically_documented', ['medsger', 'church-book3']],
      ['In 1964 the FBI sent Martin Luther King Jr. an anonymous letter that he and his advisers read as urging him to take his own life.', 'historically_documented', ['church-book3', 'gage-mlk']],
      ['COINTELPRO never really ended and continues unchanged today.', 'unverified', [], 'The programs were officially ended in 1971 and later oversight rules and congressional intelligence committees were created. Claims about later operations must be judged on their own evidence.', ['church-book1']],
    ],
    general: [['medsger', 'context', null]],
    de: {
      title: 'COINTELPRO',
      subtitle: 'Die geheimen Programme des FBI gegen politische Gruppen im eigenen Land',
      summary:
        'Von 1956 bis 1971 betrieb das FBI unter dem Namen COINTELPRO mehrere Spionageabwehrprogramme, um politische Organisationen in den USA zu überwachen, zu unterwandern, zu diskreditieren und zu stören. Die Programme wurden bekannt, nachdem Aktivisten 1971 Akten aus einem FBI-Büro entwendet hatten, und wurden vom Church Committee ausführlich dokumentiert.',
      background:
        'Das erste Programm richtete sich ab 1956 gegen die Kommunistische Partei der USA. Spätere Programme zielten auf die Socialist Workers Party, rassistische weiße Gruppen, schwarze nationalistische und Bürgerrechtsorganisationen sowie die Neue Linke. Zu den Methoden gehörten anonyme Briefe, lancierte Pressegeschichten, Informanten und Versuche, Konflikte zwischen Gruppen zu schüren.',
      claims: [
        'Das FBI betrieb von 1956 bis 1971 Programme, um politische Organisationen im Inland zu überwachen, zu unterwandern, zu diskreditieren und zu stören.',
        'Die Programme wurden bekannt, nachdem im März 1971 Akten aus dem FBI-Büro in Media, Pennsylvania, gestohlen worden waren.',
        '1964 schickte das FBI Martin Luther King Jr. einen anonymen Brief, den er und seine Berater als Aufforderung zum Suizid verstanden.',
        'COINTELPRO sei nie wirklich beendet worden und laufe bis heute unverändert weiter.',
      ],
      counters: [
        'Die Programme wurden 1971 offiziell beendet, danach entstanden neue Aufsichtsregeln und Geheimdienstausschüsse im Kongress. Behauptungen über spätere Operationen müssen jeweils anhand eigener Belege geprüft werden.',
      ],
    },
  },
  {
    key: 'tonkin',
    slug: 'gulf-of-tonkin-incident',
    title: 'Gulf of Tonkin Incident',
    subtitle: 'The attack that never happened and the resolution that followed',
    category: 'politics-power',
    status: 'partially_supported',
    tags: ['Vietnam War', 'NSA', 'Cold War', 'Pretext'],
    image: '/media/theories/gulf-of-tonkin-incident.jpg',
    imageCredit: 'The destroyer USS Maddox (DD-731) underway, early 1960s (NH 97900) – U.S. Navy / Naval History and Heritage Command, Public domain, via Wikimedia Commons https://commons.wikimedia.org/wiki/File:USS_Maddox_(DD-731)_underway_at_sea,_circa_the_early_1960s_(NH_97900).jpg',
    summary:
      'In August 1964 the United States reported two attacks by North Vietnamese boats on U.S. destroyers in the Gulf of Tonkin. The first, on 2 August, took place. The second, reported on 4 August, almost certainly did not. Congress nevertheless passed the Tonkin Gulf Resolution, which became the legal basis for the escalation of the Vietnam War.',
    background:
      'On 2 August 1964 the destroyer USS Maddox, on an intelligence patrol, was attacked by three North Vietnamese torpedo boats. On the night of 4 August the Maddox and USS Turner Joy reported a second attack in bad weather. President Johnson ordered air strikes the next day, and on 7 August Congress passed the resolution with only two votes against in the Senate.',
    origin:
      'Doubts about the second attack were raised soon afterwards, including by the commander on the scene. In 2005 the NSA declassified an internal study by its historian Robert J. Hanyok, which concluded that no attack occurred on 4 August and that intercepted signals had been mistranslated and selectively presented.',
    claims: [
      ['On 2 August 1964 North Vietnamese torpedo boats attacked the destroyer USS Maddox in the Gulf of Tonkin.', 'historically_documented', ['hanyok', 'moise']],
      ['The second attack reported on 4 August 1964 did not take place.', 'supported_by_evidence', ['hanyok', 'moise']],
      ['Congress passed the Tonkin Gulf Resolution on 7 August 1964; it authorised the President to use armed force in Southeast Asia.', 'historically_documented', ['tonkin-resolution']],
      ['U.S. officials knowingly invented the 4 August attack as a pretext for war.', 'disputed', [], 'The NSA study shows that signals intelligence was mishandled and selectively presented. Historians disagree on whether decision-makers knew at the time that no attack had happened; the first reports from the destroyers were confused rather than invented.', ['hanyok', 'moise']],
    ],
    general: [['moise', 'context', null]],
    de: {
      title: 'Tonkin-Zwischenfall',
      subtitle: 'Der Angriff, den es nie gab, und die Resolution, die folgte',
      summary:
        'Im August 1964 meldeten die USA zwei Angriffe nordvietnamesischer Boote auf US-Zerstörer im Golf von Tonkin. Der erste am 2. August fand statt. Der zweite, gemeldet am 4. August, fand mit großer Wahrscheinlichkeit nicht statt. Der Kongress verabschiedete dennoch die Tonkin-Resolution, die zur rechtlichen Grundlage für die Ausweitung des Vietnamkriegs wurde.',
      background:
        'Am 2. August 1964 wurde der Zerstörer USS Maddox auf einer Aufklärungsfahrt von drei nordvietnamesischen Torpedobooten angegriffen. In der Nacht zum 4. August meldeten die Maddox und die USS Turner Joy bei schlechtem Wetter einen zweiten Angriff. Präsident Johnson ordnete am nächsten Tag Luftangriffe an, und am 7. August verabschiedete der Kongress die Resolution mit nur zwei Gegenstimmen im Senat.',
      claims: [
        'Am 2. August 1964 griffen nordvietnamesische Torpedoboote den Zerstörer USS Maddox im Golf von Tonkin an.',
        'Der für den 4. August 1964 gemeldete zweite Angriff fand nicht statt.',
        'Der Kongress verabschiedete am 7. August 1964 die Tonkin-Resolution, die den Präsidenten zum Einsatz von Streitkräften in Südostasien ermächtigte.',
        'US-Verantwortliche hätten den Angriff vom 4. August wissentlich als Kriegsvorwand erfunden.',
      ],
      counters: [
        'Die NSA-Studie zeigt, dass Funkaufklärung falsch ausgewertet und selektiv dargestellt wurde. Historiker sind uneins, ob die Entscheidungsträger damals wussten, dass es keinen Angriff gab; die ersten Meldungen der Zerstörer waren eher verworren als erfunden.',
      ],
    },
  },
  {
    key: 'paperclip',
    slug: 'operation-paperclip',
    title: 'Operation Paperclip',
    subtitle: 'How the United States recruited German scientists after 1945',
    category: 'secret-operations',
    status: 'historically_documented',
    tags: ['Cold War', 'Nazi Germany', 'Rocketry', 'NASA'],
    image: '/media/theories/operation-paperclip.jpg',
    imageCredit: 'Operation Paperclip team of German rocket scientists at Fort Bliss, Texas (1946) – U.S. Army / NASA, Public domain, via Wikimedia Commons https://commons.wikimedia.org/wiki/File:Project_Paperclip_Team_at_Fort_Bliss.jpg',
    summary:
      'After the Second World War the United States brought more than 1,600 German scientists, engineers and technicians to America under a program known as Operation Paperclip. Among them were former members of the Nazi Party and the SS. Their pasts were often played down so that they could work and immigrate.',
    background:
      'The program was administered by the Joint Intelligence Objectives Agency. Its aim was to use German expertise in rocketry, aviation, chemistry and medicine and to keep it from the Soviet Union. The best-known recruit was Wernher von Braun, who had led the V-2 rocket program and later directed the development of the Saturn V moon rocket.',
    origin:
      'The program was partly public from the late 1940s, but the extent to which background checks were softened only became known through later research based on Freedom of Information Act requests, notably by the journalist Linda Hunt (1985 onwards). The case of Arthur Rudolph, who left the United States in 1984, drew wide attention.',
    claims: [
      ['The United States recruited more than 1,600 German scientists, engineers and technicians after 1945, including former members of the Nazi Party and the SS.', 'historically_documented', ['jacobsen-paperclip', 'hunt-secret-agenda']],
      ['Officials played down or omitted the Nazi pasts of some recruits in their files so that they could immigrate.', 'supported_by_evidence', ['hunt-secret-agenda', 'jacobsen-paperclip']],
      ['Paperclip engineer Arthur Rudolph, project manager of the Saturn V, left the United States in 1984 after an investigation into his role at the Mittelwerk forced-labour factory.', 'historically_documented', ['hunt-secret-agenda', 'neufeld-von-braun']],
      ['Former Nazis secretly controlled NASA and pursued a hidden agenda through it.', 'debunked', [], 'German engineers held senior posts, especially in the rocket program in Huntsville, but NASA was a civilian agency under American political control. No evidence shows a hidden agenda.', ['neufeld-von-braun']],
    ],
    general: [['neufeld-von-braun', 'context', null]],
    de: {
      title: 'Operation Paperclip',
      subtitle: 'Wie die USA nach 1945 deutsche Wissenschaftler anwarben',
      summary:
        'Nach dem Zweiten Weltkrieg holten die USA im Rahmen der Operation Paperclip mehr als 1.600 deutsche Wissenschaftler, Ingenieure und Techniker ins Land. Unter ihnen waren frühere Mitglieder der NSDAP und der SS. Ihre Vergangenheit wurde oft heruntergespielt, damit sie arbeiten und einwandern konnten.',
      background:
        'Verwaltet wurde das Programm von der Joint Intelligence Objectives Agency. Ziel war es, deutsches Fachwissen in Raketentechnik, Luftfahrt, Chemie und Medizin zu nutzen und der Sowjetunion vorzuenthalten. Der bekannteste Angeworbene war Wernher von Braun, der das V-2-Programm geleitet hatte und später die Entwicklung der Mondrakete Saturn V führte.',
      claims: [
        'Die USA warben nach 1945 mehr als 1.600 deutsche Wissenschaftler, Ingenieure und Techniker an, darunter frühere Mitglieder von NSDAP und SS.',
        'Behörden spielten die NS-Vergangenheit mancher Angeworbener in ihren Akten herunter oder ließen sie weg, damit sie einwandern konnten.',
        'Der Paperclip-Ingenieur Arthur Rudolph, Projektleiter der Saturn V, verließ 1984 die USA nach Ermittlungen zu seiner Rolle im Zwangsarbeiterwerk Mittelwerk.',
        'Ehemalige Nazis hätten die NASA heimlich kontrolliert und über sie eine verborgene Agenda verfolgt.',
      ],
      counters: [
        'Deutsche Ingenieure hatten leitende Posten, vor allem im Raketenprogramm in Huntsville, doch die NASA war eine zivile Behörde unter amerikanischer politischer Kontrolle. Es gibt keinen Beleg für eine verborgene Agenda.',
      ],
    },
  },
  {
    key: 'roswell',
    slug: 'roswell-incident',
    title: 'Roswell Incident',
    subtitle: 'A 1947 debris find and the alien crash story it became',
    category: 'space-ufos',
    status: 'debunked',
    tags: ['UFO', 'U.S. Air Force', 'Project Mogul', 'Cold War'],
    image: '/media/theories/roswell-incident.jpg',
    imageCredit: 'Roswell Daily Record front page, 8 July 1947 – Roswell Daily Record, Public domain, via Wikimedia Commons https://commons.wikimedia.org/wiki/File:Roswell_Daily_Record._July_8,_1947._RAAF_Captures_Flying_Saucer_On_Ranch_in_Roswell_Region._Top_of_front_page.jpg',
    summary:
      'In July 1947 the U.S. Army Air Forces at Roswell, New Mexico, announced that they had recovered a "flying disc", and corrected this the next day to a weather balloon. Decades later the event became the best-known alien crash story. Air Force investigations in the 1990s traced the debris to Project Mogul, a secret balloon program.',
    background:
      'A rancher found debris of foil, rubber, tape and sticks on a ranch north-west of Roswell. On 8 July 1947 the press office of Roswell Army Air Field issued its "flying disc" statement; on the following day the commander of the Eighth Air Force presented the material as the remains of a weather balloon. Project Mogul used trains of balloons to listen for Soviet nuclear tests and was secret at the time.',
    origin:
      'The story was largely forgotten until 1978, when a former intelligence officer, Jesse Marcel, gave interviews about the debris. The 1980 book "The Roswell Incident" by Charles Berlitz and William L. Moore made it widely known. Accounts of recovered alien bodies were added in the following years.',
    claims: [
      ['On 8 July 1947 Roswell Army Air Field announced the recovery of a "flying disc" and the statement was replaced the next day by a weather balloon explanation.', 'historically_documented', ['usaf-roswell-1995', 'gao-roswell']],
      ['The debris came from a secret Project Mogul balloon train.', 'supported_by_evidence', ['usaf-roswell-1995']],
      ['An alien spacecraft crashed near Roswell and the bodies of its crew were recovered.', 'debunked', ['berlitz-moore'], 'Two Air Force reports and a 2024 Department of Defense review found no evidence of an alien craft. The accounts of bodies appeared decades later and match 1950s tests with anthropomorphic dummies and unrelated accidents.', ['usaf-roswell-1997', 'aaro-2024']],
      ['Some administrative records of Roswell Army Air Field from the period were destroyed.', 'historically_documented', ['gao-roswell']],
      ['The destroyed records prove a cover-up of an alien crash.', 'unverified', [], 'The General Accounting Office could not determine who destroyed the records or why. Their loss alone is not evidence of what happened in 1947.', ['gao-roswell']],
    ],
    general: [['berlitz-moore', 'context', 'Origin of the modern crash narrative.']],
    de: {
      title: 'Roswell-Zwischenfall',
      subtitle: 'Ein Trümmerfund von 1947 und die Alien-Absturzgeschichte, die daraus wurde',
      summary:
        'Im Juli 1947 gaben die US Army Air Forces in Roswell, New Mexico, bekannt, eine „fliegende Scheibe“ geborgen zu haben, und korrigierten dies am nächsten Tag zu einem Wetterballon. Jahrzehnte später wurde daraus die bekannteste Geschichte über einen Alien-Absturz. Untersuchungen der Air Force in den 1990er-Jahren führten die Trümmer auf Project Mogul zurück, ein geheimes Ballonprogramm.',
      background:
        'Ein Farmer fand nordwestlich von Roswell Trümmer aus Folie, Gummi, Klebeband und Stäben. Am 8. Juli 1947 verbreitete die Pressestelle des Roswell Army Air Field die Meldung von der „fliegenden Scheibe“; am Tag darauf präsentierte der Kommandeur der Eighth Air Force das Material als Reste eines Wetterballons. Project Mogul nutzte Ballonketten, um sowjetische Atomtests abzuhören, und war damals geheim.',
      claims: [
        'Am 8. Juli 1947 meldete das Roswell Army Air Field die Bergung einer „fliegenden Scheibe“; am nächsten Tag wurde die Meldung durch die Erklärung mit dem Wetterballon ersetzt.',
        'Die Trümmer stammten von einer geheimen Ballonkette des Project Mogul.',
        'Bei Roswell sei ein außerirdisches Raumschiff abgestürzt und die Leichen der Besatzung seien geborgen worden.',
        'Einige Verwaltungsunterlagen des Roswell Army Air Field aus dieser Zeit wurden vernichtet.',
        'Die vernichteten Unterlagen bewiesen die Vertuschung eines Alien-Absturzes.',
      ],
      counters: [
        'Zwei Berichte der Air Force und eine Prüfung des US-Verteidigungsministeriums von 2024 fanden keinen Beleg für ein außerirdisches Fluggerät. Die Berichte über Leichen tauchten erst Jahrzehnte später auf und passen zu Tests mit Puppen in den 1950er-Jahren und zu anderen Unfällen.',
        'Der Rechnungshof des Kongresses konnte nicht klären, wer die Unterlagen vernichtete oder warum. Ihr Fehlen allein ist kein Beleg dafür, was 1947 geschah.',
      ],
    },
  },
  {
    key: 'reichstag',
    slug: 'reichstag-fire',
    title: 'Reichstag Fire',
    subtitle: 'Who set the German parliament on fire in 1933?',
    category: 'history',
    status: 'disputed',
    tags: ['Nazi Germany', 'Weimar Republic', 'Berlin', 'False flag'],
    image: '/media/theories/reichstag-fire.jpg',
    imageCredit: 'Firemen at the burning Reichstag building, February 1933 (NARA 535790) – U.S. National Archives (NARA), Public domain, via Wikimedia Commons https://commons.wikimedia.org/wiki/File:Firemen_work_on_the_burning_Reichstag_Building_in_February,_1933,_after_fire_broke_out_simultaneously_at_20_places...._-_NARA_-_535790.tif',
    summary:
      'On the night of 27 February 1933 the Reichstag building in Berlin burned. The Dutch council communist Marinus van der Lubbe was arrested at the scene. The new Nazi government used the fire to suspend basic rights the next day. Whether van der Lubbe acted alone or the Nazis were involved is still debated by historians.',
    background:
      'Adolf Hitler had been appointed Chancellor four weeks earlier. On 28 February President Hindenburg signed the Reichstag Fire Decree, which suspended freedom of the press, assembly and expression and allowed arrests without trial. Thousands of communists and other opponents were detained in the following weeks, shortly before the election of 5 March 1933.',
    origin:
      'The Nazi leadership immediately claimed the fire was the signal for a communist uprising. In 1933 an exile group published the "Brown Book", which accused the Nazis of setting the fire themselves. At the Leipzig trial van der Lubbe was sentenced to death, while the four communist co-defendants were acquitted. Since Fritz Tobias argued in 1962 that van der Lubbe acted alone, historians have been divided.',
    claims: [
      ['The Reichstag building burned on the night of 27 February 1933 and Marinus van der Lubbe was arrested inside.', 'historically_documented', ['hett-reichstag', 'tobias-reichstag']],
      ['The next day the Reichstag Fire Decree suspended basic rights; it was used to persecute communists and other opponents.', 'historically_documented', ['reichstag-decree', 'hett-reichstag']],
      ['The fire was part of a planned communist uprising, as the Nazi government claimed.', 'debunked', [], 'No evidence of a planned uprising was found, and the Leipzig court acquitted the four communist co-defendants in December 1933.', ['hett-reichstag', 'tobias-reichstag']],
      ['Van der Lubbe set the fire alone.', 'disputed', ['tobias-reichstag'], 'Some historians argue that the extent of the fire and the circumstances point to helpers; the question has not been settled.', ['hett-reichstag']],
      ['The Nazis set the fire themselves to seize power.', 'disputed', ['brown-book', 'hett-reichstag'], 'No direct document proves that the Nazis set the fire. Historians such as Fritz Tobias and Hans Mommsen argued for a lone perpetrator; the debate continues.', ['tobias-reichstag']],
    ],
    general: [['reichstag-decree', 'context', 'Legal consequence of the fire.']],
    de: {
      title: 'Reichstagsbrand',
      subtitle: 'Wer hat 1933 das deutsche Parlament angezündet?',
      summary:
        'In der Nacht zum 28. Februar 1933 brannte das Reichstagsgebäude in Berlin. Der niederländische Rätekommunist Marinus van der Lubbe wurde am Tatort festgenommen. Die neue NS-Regierung nutzte den Brand, um schon am nächsten Tag die Grundrechte außer Kraft zu setzen. Ob van der Lubbe allein handelte oder die Nationalsozialisten beteiligt waren, ist unter Historikern bis heute umstritten.',
      background:
        'Adolf Hitler war vier Wochen zuvor zum Reichskanzler ernannt worden. Am 28. Februar unterzeichnete Reichspräsident Hindenburg die Reichstagsbrandverordnung, die Presse-, Versammlungs- und Meinungsfreiheit aufhob und Verhaftungen ohne Gerichtsverfahren erlaubte. In den folgenden Wochen, kurz vor der Wahl am 5. März 1933, wurden Tausende Kommunisten und andere Gegner festgenommen.',
      claims: [
        'Das Reichstagsgebäude brannte in der Nacht des 27. Februar 1933, und Marinus van der Lubbe wurde im Gebäude festgenommen.',
        'Am nächsten Tag setzte die Reichstagsbrandverordnung die Grundrechte außer Kraft; sie diente zur Verfolgung von Kommunisten und anderen Gegnern.',
        'Der Brand sei Teil eines geplanten kommunistischen Aufstands gewesen, wie die NS-Regierung behauptete.',
        'Van der Lubbe habe den Brand allein gelegt.',
        'Die Nationalsozialisten hätten den Brand selbst gelegt, um die Macht zu ergreifen.',
      ],
      counters: [
        'Es fanden sich keine Belege für einen geplanten Aufstand, und das Leipziger Gericht sprach die vier kommunistischen Mitangeklagten im Dezember 1933 frei.',
        'Einige Historiker meinen, Ausmaß und Umstände des Brandes sprächen für Helfer; die Frage ist nicht geklärt.',
        'Kein Dokument beweist direkt, dass die Nationalsozialisten den Brand legten. Historiker wie Fritz Tobias und Hans Mommsen vertraten die Alleintäterthese; die Debatte dauert an.',
      ],
    },
  },
];

export const events = [
  { key: 'tuskegee-begins', title: 'Tuskegee syphilis study begins', start: '1932', year: 1932, location: 'tuskegee', category: 'science-technology', status: 'historically_documented', description: 'The Public Health Service begins observing untreated syphilis in Black men in Macon County.', de: ['Beginn der Tuskegee-Syphilis-Studie', 'Der Public Health Service beginnt, unbehandelte Syphilis bei schwarzen Männern im Macon County zu beobachten.'] },
  { key: 'tuskegee-exposed', title: 'Tuskegee study exposed by the press', start: '1972-07', year: 1972, location: null, category: 'science-technology', status: 'historically_documented', description: 'An Associated Press report by Jean Heller makes the study public; it ends later that year.', de: ['Tuskegee-Studie durch die Presse enthüllt', 'Ein Bericht der Associated Press von Jean Heller macht die Studie öffentlich; sie endet noch im selben Jahr.'] },
  { key: 'belmont-report', title: 'Belmont Report published', start: '1979-04-18', year: 1979, location: 'washington', category: 'science-technology', status: 'historically_documented', description: 'A national commission sets out ethical principles for research on human subjects.', de: ['Belmont-Bericht veröffentlicht', 'Eine nationale Kommission legt ethische Grundsätze für Forschung am Menschen fest.'] },
  { key: 'tuskegee-apology', title: 'Presidential apology for the Tuskegee study', start: '1997-05-16', year: 1997, location: 'washington', category: 'science-technology', status: 'historically_documented', description: 'President Bill Clinton apologises to the survivors and their families.', de: ['Entschuldigung des Präsidenten für die Tuskegee-Studie', 'Präsident Bill Clinton entschuldigt sich bei den Überlebenden und ihren Familien.'] },
  { key: 'cointelpro-begins', title: 'First COINTELPRO program begins', start: '1956', year: 1956, location: 'washington', category: 'intelligence-agencies', status: 'historically_documented', description: 'The FBI starts a counterintelligence program against the Communist Party USA.', de: ['Erstes COINTELPRO-Programm beginnt', 'Das FBI startet ein Programm gegen die Kommunistische Partei der USA.'] },
  { key: 'media-burglary', title: 'Burglary of the FBI office in Media', start: '1971-03-08', year: 1971, location: 'media-pa', category: 'intelligence-agencies', status: 'historically_documented', description: 'Activists steal files from the FBI field office and send them to newspapers.', de: ['Einbruch ins FBI-Büro in Media', 'Aktivisten stehlen Akten aus dem FBI-Büro und schicken sie an Zeitungen.'] },
  { key: 'cointelpro-ends', title: 'COINTELPRO officially ended', start: '1971-04', year: 1971, location: 'washington', category: 'intelligence-agencies', status: 'historically_documented', description: 'J. Edgar Hoover orders an end to the counterintelligence programs.', de: ['COINTELPRO offiziell beendet', 'J. Edgar Hoover ordnet das Ende der Programme an.'] },
  { key: 'tonkin-aug2', title: 'Attack on USS Maddox', start: '1964-08-02', year: 1964, location: 'gulf-of-tonkin', category: 'politics-power', status: 'historically_documented', description: 'Three North Vietnamese torpedo boats attack the destroyer USS Maddox.', de: ['Angriff auf die USS Maddox', 'Drei nordvietnamesische Torpedoboote greifen den Zerstörer USS Maddox an.'] },
  { key: 'tonkin-aug4', title: 'Reported second attack in the Gulf of Tonkin', start: '1964-08-04', year: 1964, location: 'gulf-of-tonkin', category: 'politics-power', status: 'debunked', description: 'Two U.S. destroyers report an attack in bad weather; later analysis shows it did not take place.', de: ['Gemeldeter zweiter Angriff im Golf von Tonkin', 'Zwei US-Zerstörer melden bei schlechtem Wetter einen Angriff; spätere Analysen zeigen, dass er nicht stattfand.'] },
  { key: 'tonkin-resolution', title: 'Tonkin Gulf Resolution passed', start: '1964-08-07', year: 1964, location: 'washington', category: 'politics-power', status: 'historically_documented', description: 'Congress authorises the President to use armed force in Southeast Asia.', de: ['Tonkin-Resolution verabschiedet', 'Der Kongress ermächtigt den Präsidenten zum Einsatz von Streitkräften in Südostasien.'] },
  { key: 'hanyok-released', title: 'NSA releases Gulf of Tonkin study', start: '2005', year: 2005, location: null, category: 'politics-power', status: 'historically_documented', description: 'The NSA declassifies Robert J. Hanyok’s study concluding that the 4 August attack did not happen.', de: ['NSA gibt Studie zum Tonkin-Zwischenfall frei', 'Die NSA gibt Robert J. Hanyoks Studie frei, nach der der Angriff vom 4. August nicht stattfand.'] },
  { key: 'paperclip-begins', title: 'First German scientists brought to the United States', start: '1945', year: 1945, location: null, category: 'secret-operations', status: 'historically_documented', description: 'Wernher von Braun and other rocket engineers arrive in the United States.', de: ['Erste deutsche Wissenschaftler in die USA gebracht', 'Wernher von Braun und weitere Raketeningenieure kommen in die USA.'] },
  { key: 'saturn-v-first-flight', title: 'First flight of the Saturn V', start: '1967-11-09', year: 1967, location: 'kennedy-space-center', category: 'space-ufos', status: 'historically_documented', description: 'The uncrewed Apollo 4 mission launches the moon rocket developed under von Braun.', de: ['Erstflug der Saturn V', 'Die unbemannte Mission Apollo 4 startet die unter von Braun entwickelte Mondrakete.'] },
  { key: 'rudolph-leaves', title: 'Arthur Rudolph leaves the United States', start: '1984', year: 1984, location: null, category: 'secret-operations', status: 'historically_documented', description: 'The former Saturn V manager leaves after an investigation into his wartime role.', de: ['Arthur Rudolph verlässt die USA', 'Der frühere Saturn-V-Projektleiter geht nach Ermittlungen zu seiner Rolle im Krieg.'] },
  { key: 'roswell-press-release', title: "Roswell 'flying disc' press release", start: '1947-07-08', year: 1947, location: 'roswell', category: 'space-ufos', status: 'historically_documented', description: 'Roswell Army Air Field announces a recovered "flying disc"; a weather balloon explanation follows the next day.', de: ['Roswell-Pressemitteilung über eine „fliegende Scheibe“', 'Das Roswell Army Air Field meldet eine geborgene „fliegende Scheibe“; am nächsten Tag folgt die Erklärung mit dem Wetterballon.'] },
  { key: 'roswell-book', title: "Publication of 'The Roswell Incident'", start: '1980', year: 1980, location: null, category: 'space-ufos', status: 'historically_documented', description: 'Charles Berlitz and William L. Moore popularise the alien crash narrative.', de: ['Veröffentlichung von „The Roswell Incident“', 'Charles Berlitz und William L. Moore machen die Alien-Absturzgeschichte populär.'] },
  { key: 'roswell-reports', title: 'Air Force Roswell reports', start: '1995', end: '1997', year: 1995, endYear: 1997, period: true, location: 'washington', category: 'space-ufos', status: 'historically_documented', description: 'The Air Force attributes the debris to Project Mogul and the body accounts to later dummy tests.', de: ['Roswell-Berichte der Air Force', 'Die Air Force führt die Trümmer auf Project Mogul und die Berichte über Leichen auf spätere Puppentests zurück.'] },
  { key: 'reichstag-fire', title: 'Reichstag fire', start: '1933-02-27', year: 1933, location: 'reichstag', category: 'history', status: 'historically_documented', description: 'The Reichstag building burns; Marinus van der Lubbe is arrested inside.', de: ['Reichstagsbrand', 'Das Reichstagsgebäude brennt; Marinus van der Lubbe wird im Gebäude festgenommen.'] },
  { key: 'reichstag-decree', title: 'Reichstag Fire Decree', start: '1933-02-28', year: 1933, location: 'reichstag', category: 'history', status: 'historically_documented', description: 'President Hindenburg suspends basic rights by emergency decree.', de: ['Reichstagsbrandverordnung', 'Reichspräsident Hindenburg setzt per Notverordnung die Grundrechte außer Kraft.'] },
  { key: 'reichstag-trial', title: 'Reichstag fire trial in Leipzig', start: '1933-09-21', end: '1933-12-23', year: 1933, endYear: 1933, period: true, location: 'leipzig', category: 'history', status: 'historically_documented', description: 'Van der Lubbe is sentenced to death; the four communist co-defendants are acquitted.', de: ['Reichstagsbrandprozess in Leipzig', 'Van der Lubbe wird zum Tode verurteilt; die vier kommunistischen Mitangeklagten werden freigesprochen.'] },
];

export const documents = [
  { key: 'belmont-report-doc', title: 'The Belmont Report (1979)', type: 'report', source: 'belmont', archive: 'U.S. Department of Health and Human Services', license: 'U.S. government work (public domain); linked, not copied.' },
  { key: 'cointelpro-files-doc', title: 'FBI COINTELPRO files', type: 'file collection', source: 'fbi-vault-cointelpro', archive: 'FBI Records: The Vault', license: 'U.S. government work (public domain); linked, not copied.' },
  { key: 'tonkin-resolution-doc', title: 'Tonkin Gulf Resolution (1964)', type: 'joint resolution', source: 'tonkin-resolution', archive: 'U.S. National Archives', license: 'U.S. government work (public domain); linked, not copied.' },
];

// Relationships: [fromType, fromKey, toType, toKey, kind, verification, label]
export const relationships = [
  ['theory', 'tuskegee', 'organization', 'phs', 'documented', 'documented', 'Ran the study'],
  ['theory', 'tuskegee', 'location', 'tuskegee', 'documented', 'documented', 'Study site'],
  ['theory', 'tuskegee', 'event', 'tuskegee-begins', 'documented', 'documented', null],
  ['theory', 'tuskegee', 'event', 'tuskegee-exposed', 'documented', 'documented', null],
  ['theory', 'tuskegee', 'event', 'belmont-report', 'documented', 'documented', 'Consequence'],
  ['theory', 'tuskegee', 'event', 'tuskegee-apology', 'documented', 'documented', null],
  ['theory', 'tuskegee', 'document', 'belmont-report-doc', 'documented', 'documented', null],
  ['theory', 'tuskegee', 'theory', 'mkultra', 'thematic', 'documented', 'Unethical human experimentation'],
  ['theory', 'cointelpro', 'organization', 'fbi', 'documented', 'documented', 'Run by'],
  ['theory', 'cointelpro', 'person', 'hoover', 'documented', 'documented', 'FBI Director'],
  ['theory', 'cointelpro', 'person', 'mlk', 'documented', 'documented', 'Target'],
  ['theory', 'cointelpro', 'organization', 'citizens-commission', 'documented', 'documented', 'Exposed the programs'],
  ['theory', 'cointelpro', 'organization', 'church-committee', 'documented', 'documented', 'Investigated by'],
  ['theory', 'cointelpro', 'event', 'cointelpro-begins', 'documented', 'documented', null],
  ['theory', 'cointelpro', 'event', 'media-burglary', 'documented', 'documented', null],
  ['theory', 'cointelpro', 'event', 'cointelpro-ends', 'documented', 'documented', null],
  ['theory', 'cointelpro', 'event', 'church-committee', 'documented', 'documented', null],
  ['theory', 'cointelpro', 'document', 'cointelpro-files-doc', 'documented', 'documented', null],
  ['theory', 'cointelpro', 'theory', 'mkultra', 'thematic', 'documented', 'Exposed by the Church Committee'],
  ['theory', 'tonkin', 'person', 'lbj', 'documented', 'documented', 'Ordered air strikes'],
  ['theory', 'tonkin', 'organization', 'nsa', 'documented', 'documented', 'Signals intelligence'],
  ['theory', 'tonkin', 'location', 'gulf-of-tonkin', 'documented', 'documented', null],
  ['theory', 'tonkin', 'event', 'tonkin-aug2', 'documented', 'documented', null],
  ['theory', 'tonkin', 'event', 'tonkin-aug4', 'claimed', 'documented', 'Did not take place'],
  ['theory', 'tonkin', 'event', 'tonkin-resolution', 'documented', 'documented', null],
  ['theory', 'tonkin', 'event', 'hanyok-released', 'documented', 'documented', null],
  ['theory', 'tonkin', 'document', 'tonkin-resolution-doc', 'documented', 'documented', null],
  ['theory', 'tonkin', 'theory', 'northwoods', 'thematic', 'documented', 'Pretexts for military action'],
  ['theory', 'paperclip', 'organization', 'jioa', 'documented', 'documented', 'Administered by'],
  ['theory', 'paperclip', 'person', 'von-braun', 'documented', 'documented', 'Recruited'],
  ['theory', 'paperclip', 'person', 'rudolph', 'documented', 'documented', 'Recruited'],
  ['theory', 'paperclip', 'organization', 'nasa', 'documented', 'documented', 'Later employer of recruits'],
  ['theory', 'paperclip', 'location', 'huntsville', 'documented', 'documented', 'Rocket program'],
  ['theory', 'paperclip', 'event', 'paperclip-begins', 'documented', 'documented', null],
  ['theory', 'paperclip', 'event', 'saturn-v-first-flight', 'documented', 'documented', null],
  ['theory', 'paperclip', 'event', 'rudolph-leaves', 'documented', 'documented', null],
  ['theory', 'paperclip', 'theory', 'moon', 'thematic', 'documented', 'Saturn V'],
  ['theory', 'roswell', 'organization', 'usaf', 'documented', 'documented', 'Investigated'],
  ['theory', 'roswell', 'location', 'roswell', 'documented', 'documented', null],
  ['theory', 'roswell', 'event', 'roswell-press-release', 'documented', 'documented', null],
  ['theory', 'roswell', 'event', 'roswell-book', 'claimed', 'documented', 'Origin of the crash narrative'],
  ['theory', 'roswell', 'event', 'roswell-reports', 'counter', 'documented', 'Project Mogul explanation'],
  ['theory', 'roswell', 'event', 'aaro-report', 'counter', 'documented', 'No evidence of alien technology'],
  ['theory', 'roswell', 'theory', 'area51', 'thematic', 'documented', 'Space & UFO narratives'],
  ['theory', 'reichstag', 'person', 'van-der-lubbe', 'documented', 'documented', 'Arrested at the scene'],
  ['theory', 'reichstag', 'person', 'dimitrov', 'documented', 'documented', 'Acquitted co-defendant'],
  ['theory', 'reichstag', 'organization', 'reichsgericht', 'documented', 'documented', 'Tried the case'],
  ['theory', 'reichstag', 'location', 'reichstag', 'documented', 'documented', null],
  ['theory', 'reichstag', 'event', 'reichstag-fire', 'documented', 'documented', null],
  ['theory', 'reichstag', 'event', 'reichstag-decree', 'documented', 'documented', 'Consequence'],
  ['theory', 'reichstag', 'event', 'reichstag-trial', 'documented', 'documented', null],
  ['theory', 'reichstag', 'theory', 'northwoods', 'thematic', 'documented', "'False flag' narratives"],
  ['person', 'hoover', 'organization', 'fbi', 'documented', 'documented', 'Director'],
  ['person', 'von-braun', 'organization', 'nasa', 'documented', 'documented', 'Center director'],
  ['person', 'rudolph', 'organization', 'nasa', 'documented', 'documented', 'Saturn V project manager'],
  ['organization', 'church-committee', 'organization', 'fbi', 'documented', 'documented', 'Investigated'],
];
