// Initial archive content for The Conspiracy Atlas.
//
// Editorial rules:
// - Historical facts and further claims are kept separate (claims carry their own evidence status).
// - Only real, verifiable publications are cited. No invented documents, quotes or connections.
// - URLs were NOT machine-verified when this file was written (no network access in the build
//   environment). `lastChecked` is therefore null. Run `npm run check-sources` before deployment
//   and set the dates after a successful manual check.
//
// Keys (`key`) are internal references used only by scripts/generate-seed.mjs.

export const categories = [
  ['politics-power', 'Politics & Power', 'Governments, elections, scandals and the use of political power.'],
  ['secret-organizations', 'Secret Organizations', 'Societies and orders that operated or are claimed to operate in secret.'],
  ['intelligence-agencies', 'Intelligence Agencies', 'Programs and operations of intelligence services.'],
  ['space-ufos', 'Space & UFOs', 'Spaceflight, unidentified aerial phenomena and related claims.'],
  ['science-technology', 'Science & Technology', 'Scientific programs, technologies and claims about them.'],
  ['history', 'History', 'Historical events and their interpretations.'],
  ['economy-finance', 'Economy & Finance', 'Markets, banking and economic power.'],
  ['media-society', 'Media & Society', 'Mass media, propaganda and public opinion.'],
  ['internet-modern-myths', 'Internet & Modern Myths', 'Narratives that emerged or spread online.'],
  ['secret-operations', 'Secret Operations', 'Covert plans and operations, proposed or executed.'],
];

export const categoriesDe = {
  'politics-power': ['Politik & Macht', 'Regierungen, Wahlen, Skandale und Machtausübung.'],
  'secret-organizations': ['Geheimorganisationen', 'Gesellschaften und Orden, die im Geheimen wirkten oder wirken sollen.'],
  'intelligence-agencies': ['Geheimdienste', 'Programme und Operationen von Nachrichtendiensten.'],
  'space-ufos': ['Raumfahrt & UFOs', 'Raumfahrt, unidentifizierte Luftphänomene und Behauptungen dazu.'],
  'science-technology': ['Wissenschaft & Technologie', 'Wissenschaftliche Programme, Technologien und Behauptungen darüber.'],
  history: ['Geschichte', 'Historische Ereignisse und ihre Deutungen.'],
  'economy-finance': ['Wirtschaft & Finanzen', 'Märkte, Banken und wirtschaftliche Macht.'],
  'media-society': ['Medien & Gesellschaft', 'Massenmedien, Propaganda und öffentliche Meinung.'],
  'internet-modern-myths': ['Internet & moderne Mythen', 'Erzählungen, die online entstanden oder sich verbreiteten.'],
  'secret-operations': ['Geheimoperationen', 'Verdeckte Pläne und Operationen, vorgeschlagen oder durchgeführt.'],
};

export const locations = [
  { key: 'washington', name: 'Washington, D.C.', country: 'US', lat: 38.8977, lng: -77.0365, kind: 'city', description: 'Capital of the United States.' },
  { key: 'langley', name: 'Langley, Virginia', country: 'US', lat: 38.9517, lng: -77.1467, kind: 'site', description: 'Location of CIA headquarters.' },
  { key: 'pentagon', name: 'The Pentagon, Arlington', country: 'US', lat: 38.8719, lng: -77.0563, kind: 'site', description: 'Headquarters of the U.S. Department of Defense.' },
  { key: 'watergate-complex', name: 'Watergate complex', country: 'US', lat: 38.8997, lng: -77.0553, kind: 'site', description: 'Office and hotel complex in Washington, D.C.' },
  { key: 'groom-lake', name: 'Groom Lake (Area 51), Nevada', country: 'US', lat: 37.235, lng: -115.8111, kind: 'site', description: 'Remote U.S. Air Force facility within the Nevada Test and Training Range.' },
  { key: 'kennedy-space-center', name: 'Kennedy Space Center, Florida', country: 'US', lat: 28.6084, lng: -80.6043, kind: 'site', description: 'Launch site of the Apollo missions (Launch Complex 39A).' },
  { key: 'houston', name: 'Houston, Texas', country: 'US', lat: 29.5593, lng: -95.09, kind: 'city', description: 'Location of NASA mission control (Johnson Space Center).' },
  { key: 'dealey-plaza', name: 'Dealey Plaza, Dallas', country: 'US', lat: 32.7788, lng: -96.8084, kind: 'site', description: 'Site of the assassination of President John F. Kennedy.' },
  { key: 'new-york', name: 'New York City', country: 'US', lat: 40.7505, lng: -73.9934, kind: 'city', description: 'Largest city in the United States.' },
  { key: 'ingolstadt', name: 'Ingolstadt, Bavaria', country: 'DE', lat: 48.7665, lng: 11.4258, kind: 'city', description: 'University town where the Order of the Illuminati was founded.' },
  { key: 'munich', name: 'Munich, Bavaria', country: 'DE', lat: 48.1351, lng: 11.582, kind: 'city', description: 'Seat of the Bavarian Elector.' },
  { key: 'havana', name: 'Havana', country: 'CU', lat: 23.1136, lng: -82.3666, kind: 'city', description: 'Capital of Cuba.' },
];

export const organizations = [
  { key: 'cia', name: 'Central Intelligence Agency (CIA)', kind: 'agency', founded: '1947', country: 'US', location: 'langley', description: 'Foreign intelligence service of the United States, established by the National Security Act of 1947.' },
  { key: 'jcs', name: 'Joint Chiefs of Staff', kind: 'institution', founded: '1942', country: 'US', location: 'pentagon', description: 'Body of the most senior uniformed leaders of the U.S. armed forces.' },
  { key: 'usaf', name: 'United States Air Force', kind: 'agency', founded: '1947', country: 'US', location: 'pentagon', description: 'Air service branch of the U.S. armed forces.' },
  { key: 'nasa', name: 'NASA', kind: 'agency', founded: '1958', country: 'US', location: 'houston', description: 'National Aeronautics and Space Administration, the U.S. civil space agency.' },
  { key: 'illuminati', name: 'Order of the Illuminati (Bavaria)', kind: 'group', founded: '1776', country: 'DE', location: 'ingolstadt', description: 'Secret society of the Enlightenment era founded in 1776 and suppressed by Bavarian edicts in 1784–1785.' },
  { key: 'church-committee', name: 'Church Committee (U.S. Senate)', kind: 'commission', founded: '1975', country: 'US', location: 'washington', description: 'Senate Select Committee to Study Governmental Operations with Respect to Intelligence Activities (1975–1976), chaired by Senator Frank Church.' },
  { key: 'warren-commission', name: 'Warren Commission', kind: 'commission', founded: '1963', country: 'US', location: 'washington', description: "President's Commission on the Assassination of President Kennedy, chaired by Chief Justice Earl Warren." },
  { key: 'hsca', name: 'House Select Committee on Assassinations', kind: 'commission', founded: '1976', country: 'US', location: 'washington', description: 'U.S. House committee (1976–1979) that investigated the assassinations of John F. Kennedy and Martin Luther King Jr.' },
  { key: 'arrb', name: 'Assassination Records Review Board', kind: 'commission', founded: '1994', country: 'US', location: 'washington', description: 'Independent agency (1994–1998) created under the JFK Records Act to review and release assassination-related records.' },
  { key: 'senate-watergate', name: 'Senate Watergate Committee', kind: 'commission', founded: '1973', country: 'US', location: 'washington', description: 'Senate Select Committee on Presidential Campaign Activities, chaired by Senator Sam Ervin.' },
  { key: 'crp', name: 'Committee for the Re-Election of the President', kind: 'organization', founded: '1971', country: 'US', location: 'washington', description: "Fundraising and campaign organization for President Nixon's 1972 re-election." },
  { key: 'epa', name: 'U.S. Environmental Protection Agency', kind: 'agency', founded: '1970', country: 'US', location: 'washington', description: 'Federal agency responsible for environmental protection.' },
];

export const people = [
  { key: 'lemnitzer', name: 'Lyman L. Lemnitzer', role: 'Chairman of the Joint Chiefs of Staff (1960–1962)', born: '1899', died: '1988', description: 'U.S. Army general who signed the Operation Northwoods memorandum as chairman of the Joint Chiefs.' },
  { key: 'gottlieb', name: 'Sidney Gottlieb', role: 'CIA chemist', born: '1918', died: '1999', description: 'Head of the CIA chemical division that ran the MKUltra program.' },
  { key: 'helms', name: 'Richard Helms', role: 'Director of Central Intelligence (1966–1973)', born: '1913', died: '2002', description: 'CIA director who ordered the destruction of MKUltra records in 1973.' },
  { key: 'olson', name: 'Frank Olson', role: 'U.S. Army scientist', born: '1910', died: '1953', description: 'Scientist who died in November 1953, days after being given LSD without his knowledge in a CIA experiment.' },
  { key: 'nixon', name: 'Richard Nixon', role: '37th President of the United States', born: '1913', died: '1994', description: 'Resigned from office on 9 August 1974 as a result of the Watergate scandal.' },
  { key: 'felt', name: 'W. Mark Felt', role: 'FBI Associate Director', born: '1913', died: '2008', description: "Identified himself in 2005 as 'Deep Throat', the confidential source of The Washington Post." },
  { key: 'kennedy', name: 'John F. Kennedy', role: '35th President of the United States', born: '1917', died: '1963', description: 'Assassinated in Dallas on 22 November 1963.' },
  { key: 'oswald', name: 'Lee Harvey Oswald', role: 'Accused assassin', born: '1939', died: '1963', description: 'Named by the Warren Commission as the assassin of President Kennedy; shot and killed by Jack Ruby on 24 November 1963.' },
  { key: 'weishaupt', name: 'Adam Weishaupt', role: 'Founder of the Illuminati', born: '1748', died: '1830', description: 'Professor of canon law at the University of Ingolstadt who founded the Order of the Illuminati in 1776.' },
  { key: 'barruel', name: 'Augustin Barruel', role: 'Jesuit priest and author', born: '1741', died: '1820', description: 'Author of a multi-volume work (1797–1798) that blamed the French Revolution on a conspiracy including the Illuminati.' },
  { key: 'robison', name: 'John Robison', role: 'Physicist and author', born: '1739', died: '1805', description: "Scottish physicist whose 'Proofs of a Conspiracy' (1797) made similar claims about the Illuminati and Freemasonry." },
  { key: 'lazar', name: 'Bob Lazar', role: 'Claimant', born: '1959', died: null, description: 'Claimed in 1989 to have worked on extraterrestrial spacecraft at a site near Area 51. His claims are unverified.' },
  { key: 'armstrong', name: 'Neil Armstrong', role: 'Apollo 11 commander', born: '1930', died: '2012', description: 'First person to walk on the Moon, on 20 July 1969 (UTC: 21 July).' },
  { key: 'kaysing', name: 'Bill Kaysing', role: 'Author', born: '1922', died: '2005', description: "Author of 'We Never Went to the Moon' (1976), an early publication of the Moon landing hoax claim." },
];

export const sources = [
  // Operation Northwoods
  { key: 'northwoods-memo', title: 'Justification for US Military Intervention in Cuba (Memorandum for the Secretary of Defense, 13 March 1962)', author: 'Joint Chiefs of Staff (L. L. Lemnitzer)', publisher: 'National Security Archive (online copy)', date: '1962-03-13', type: 'primary_document', primary: true, url: 'https://nsarchive2.gwu.edu/news/20010430/northwoods.pdf', quality: 'Declassified primary document. Shows what was proposed, not what was carried out.' },
  { key: 'nsa-northwoods', title: 'Pentagon Proposed Pretexts for Cuba Invasion in 1962', author: null, publisher: 'National Security Archive, George Washington University', date: '2001-04-30', type: 'archive_collection', primary: false, url: 'https://nsarchive2.gwu.edu/news/20010430/', quality: 'Respected non-governmental archive presenting the declassified memorandum with context.' },
  { key: 'bamford-body', title: 'Body of Secrets: Anatomy of the Ultra-Secret National Security Agency', author: 'James Bamford', publisher: 'Doubleday', date: '2001', type: 'book', primary: false, url: null, quality: 'Investigative non-fiction that brought Northwoods to wide public attention.' },
  { key: 'nara-jfk', title: 'JFK Assassination Records Collection', author: null, publisher: 'U.S. National Archives and Records Administration', date: null, type: 'archive_collection', primary: true, url: 'https://www.archives.gov/research/jfk', quality: 'Official archive of records released under the JFK Records Act of 1992.' },
  // MKUltra
  { key: 'mkultra-hearing', title: "Project MKULTRA, the CIA's Program of Research in Behavioral Modification (Joint Hearing, 3 August 1977)", author: 'U.S. Senate Select Committee on Intelligence; Subcommittee on Health and Scientific Research', publisher: 'U.S. Government Printing Office', date: '1977-08-03', type: 'government_report', primary: true, url: 'https://www.intelligence.senate.gov/sites/default/files/hearings/95mkultra.pdf', quality: 'Official congressional hearing record including testimony of CIA Director Stansfield Turner.' },
  { key: 'church-book1', title: 'Final Report of the Select Committee to Study Governmental Operations with Respect to Intelligence Activities, Book I', author: 'U.S. Senate (Church Committee)', publisher: 'U.S. Government Printing Office', date: '1976-04-26', type: 'government_report', primary: true, url: 'https://www.senate.gov/about/powers-procedures/investigations/church-committee.htm', quality: 'Official investigation report. The URL leads to the Senate overview page of the committee.' },
  { key: 'rockefeller', title: 'Report to the President by the Commission on CIA Activities Within the United States', author: 'Rockefeller Commission', publisher: 'U.S. Government Printing Office', date: '1975-06', type: 'government_report', primary: true, url: null, quality: 'Official presidential commission report; first public account of the Olson case.' },
  { key: 'kinzer', title: 'Poisoner in Chief: Sidney Gottlieb and the CIA Search for Mind Control', author: 'Stephen Kinzer', publisher: 'Henry Holt and Co.', date: '2019', type: 'book', primary: false, url: null, quality: 'Journalistic biography based on declassified records and interviews.' },
  // Watergate
  { key: 'nara-watergate', title: 'Watergate (research guide)', author: null, publisher: 'U.S. National Archives and Records Administration', date: null, type: 'archive_collection', primary: true, url: 'https://www.archives.gov/research/investigations/watergate', quality: 'Official guide to Watergate records held by the National Archives.' },
  { key: 'us-v-nixon', title: 'United States v. Nixon, 418 U.S. 683 (1974)', author: 'Supreme Court of the United States', publisher: 'Justia (online copy)', date: '1974-07-24', type: 'court_record', primary: true, url: 'https://supreme.justia.com/cases/federal/us/418/683/', quality: 'Unanimous Supreme Court decision ordering release of the White House tapes.' },
  { key: 'senate-watergate-report', title: 'Final Report of the Senate Select Committee on Presidential Campaign Activities', author: 'U.S. Senate', publisher: 'U.S. Government Printing Office', date: '1974-06', type: 'government_report', primary: true, url: 'https://www.senate.gov/about/powers-procedures/investigations/watergate.htm', quality: 'Official committee report. The URL leads to the Senate overview page.' },
  { key: 'nixon-library', title: 'Richard Nixon Presidential Library and Museum – White House Tapes', author: null, publisher: 'U.S. National Archives and Records Administration', date: null, type: 'archive_collection', primary: true, url: 'https://www.nixonlibrary.gov/', quality: 'Official holder of the Nixon White House recordings.' },
  { key: 'atpm', title: "All the President's Men", author: 'Carl Bernstein; Bob Woodward', publisher: 'Simon & Schuster', date: '1974', type: 'book', primary: false, url: null, quality: 'Account by the two Washington Post reporters who covered the scandal.' },
  { key: 'felt-vanity', title: "I'm the Guy They Called Deep Throat", author: "John D. O'Connor", publisher: 'Vanity Fair', date: '2005-07', type: 'news_article', primary: false, url: null, quality: 'Magazine article in which Mark Felt\'s identity as "Deep Throat" was revealed; confirmed by Woodward and Bernstein.' },
  { key: 'silent-coup', title: 'Silent Coup: The Removal of a President', author: 'Len Colodny; Robert Gettlin', publisher: "St. Martin's Press", date: '1991', type: 'book', primary: false, url: null, quality: 'Revisionist account; its central claims are disputed and were the subject of a defamation lawsuit by John Dean.' },
  // Area 51
  { key: 'cia-u2-history', title: 'The Central Intelligence Agency and Overhead Reconnaissance: The U-2 and OXCART Programs, 1954–1974', author: 'Gregory W. Pedlow; Donald E. Welzenbach', publisher: 'CIA History Staff (released 2013, published by the National Security Archive)', date: '1992', type: 'government_report', primary: true, url: 'https://nsarchive2.gwu.edu/NSAEBB/NSAEBB443/', quality: 'Official CIA history, declassified in 2013 after a FOIA request; first official acknowledgement of Area 51.' },
  { key: 'haines-ufo', title: "CIA's Role in the Study of UFOs, 1947–90", author: 'Gerald K. Haines', publisher: 'Studies in Intelligence (CIA)', date: '1997', type: 'government_report', primary: false, url: null, quality: 'Official CIA historical article. Links many 1950s–60s UFO reports to secret reconnaissance flights.' },
  { key: 'aaro-2024', title: 'Report on the Historical Record of U.S. Government Involvement with Unidentified Anomalous Phenomena (UAP), Volume I', author: 'All-domain Anomaly Resolution Office (AARO)', publisher: 'U.S. Department of Defense', date: '2024-03', type: 'government_report', primary: true, url: 'https://www.aaro.mil/', quality: 'Official review that found no verifiable evidence of extraterrestrial technology in U.S. government programs.' },
  { key: 'jacobsen', title: 'Area 51: An Uncensored History', author: 'Annie Jacobsen', publisher: 'Little, Brown and Company', date: '2011', type: 'book', primary: false, url: null, quality: 'Popular history; some of its central claims are disputed by historians. Use with caution.' },
  // Moon landing
  { key: 'nasa-apollo11', title: 'Apollo 11 – Mission Overview', author: null, publisher: 'NASA', date: null, type: 'website', primary: true, url: 'https://www.nasa.gov/mission/apollo-11/', quality: 'Official agency record. Corroborated by independent evidence listed in this entry.' },
  { key: 'lroc', title: 'Lunar Reconnaissance Orbiter Camera (LROC) image archive', author: null, publisher: 'Arizona State University / NASA', date: null, type: 'archive_collection', primary: true, url: 'https://www.lroc.asu.edu/', quality: 'Orbital images that show Apollo landing hardware and astronaut tracks.' },
  { key: 'lpi-apollo11', title: 'Apollo 11 Mission (lunar science overview)', author: null, publisher: 'Lunar and Planetary Institute', date: null, type: 'reference_work', primary: false, url: 'https://www.lpi.usra.edu/lunar/missions/apollo/apollo_11/', quality: 'Scientific overview including sample return and experiments.' },
  { key: 'dickey-llr', title: 'Lunar Laser Ranging: A Continuing Legacy of the Apollo Program', author: 'J. O. Dickey et al.', publisher: 'Science, vol. 265, pp. 482–490', date: '1994', type: 'academic_paper', primary: true, url: null, quality: 'Peer-reviewed paper on decades of laser ranging to the retroreflectors left by Apollo missions.' },
  { key: 'kaysing-book', title: "We Never Went to the Moon: America's Thirty Billion Dollar Swindle", author: 'Bill Kaysing', publisher: 'Self-published', date: '1976', type: 'book', primary: true, url: null, quality: 'Origin of the claim. A primary source for the history of the theory, not evidence for it.' },
  // Illuminati
  { key: 'britannica-illuminati', title: 'Illuminati', author: null, publisher: 'Encyclopaedia Britannica', date: null, type: 'reference_work', primary: false, url: 'https://www.britannica.com/topic/illuminati-group-designation', quality: 'Reputable reference work summarising the historical order.' },
  { key: 'barruel-memoirs', title: "Mémoires pour servir à l'histoire du jacobinisme", author: 'Augustin Barruel', publisher: 'London (various editions)', date: '1797', type: 'book', primary: true, url: null, quality: 'Origin of the revolutionary-conspiracy narrative. Primary source for the theory, not evidence for it.' },
  { key: 'robison-proofs', title: 'Proofs of a Conspiracy against All the Religions and Governments of Europe', author: 'John Robison', publisher: 'Edinburgh', date: '1797', type: 'book', primary: true, url: null, quality: 'Origin of the narrative in the English-speaking world. Not evidence for its claims.' },
  { key: 'barkun', title: 'A Culture of Conspiracy: Apocalyptic Visions in Contemporary America', author: 'Michael Barkun', publisher: 'University of California Press', date: '2003', type: 'book', primary: false, url: null, quality: 'Academic study of modern conspiracy narratives, including Illuminati beliefs.' },
  // Chemtrails
  { key: 'shearer-2016', title: 'Quantifying expert consensus against the existence of a secret, large-scale atmospheric spraying program', author: 'Christine Shearer; Mick West; Ken Caldeira; Steven J. Davis', publisher: 'Environmental Research Letters 11, 084011', date: '2016-08', type: 'academic_paper', primary: true, url: 'https://doi.org/10.1088/1748-9326/11/8/084011', quality: 'Peer-reviewed survey of 77 atmospheric chemists and geochemists.' },
  { key: 'epa-contrails', title: 'Aircraft Contrails Factsheet (EPA430-F-00-005)', author: 'U.S. EPA; NASA; NOAA; FAA', publisher: 'U.S. Environmental Protection Agency', date: '2000-09', type: 'government_report', primary: true, url: null, quality: 'Official explanation of how contrails form and persist.' },
  { key: 'royal-society-geo', title: 'Geoengineering the Climate: Science, Governance and Uncertainty', author: 'The Royal Society', publisher: 'The Royal Society', date: '2009-09', type: 'academic_paper', primary: false, url: null, quality: 'Scientific assessment of proposed geoengineering methods (research proposals, not deployments).' },
  // JFK
  { key: 'warren-report', title: "Report of the President's Commission on the Assassination of President Kennedy", author: 'Warren Commission', publisher: 'U.S. Government Printing Office', date: '1964-09-24', type: 'government_report', primary: true, url: 'https://www.archives.gov/research/jfk/warren-commission-report', quality: 'Official investigation report. Its single-gunman conclusion remains contested by critics.' },
  { key: 'hsca-report', title: 'Report of the Select Committee on Assassinations, U.S. House of Representatives', author: 'House Select Committee on Assassinations', publisher: 'U.S. Government Printing Office', date: '1979', type: 'government_report', primary: true, url: 'https://www.archives.gov/research/jfk/select-committee-report', quality: "Official report. Its 'probable conspiracy' finding relied largely on acoustic evidence that was later disputed." },
  { key: 'nas-acoustics', title: 'Report of the Committee on Ballistic Acoustics', author: 'National Research Council', publisher: 'National Academy Press', date: '1982', type: 'academic_paper', primary: true, url: null, quality: 'Independent scientific review that rejected the HSCA acoustic analysis.' },
];

// Theories ---------------------------------------------------------------------------------------
// claim: [text, status, [sourceKeys], counterArgument?, [counterSourceKeys]]
export const theories = [
  {
    key: 'northwoods',
    slug: 'operation-northwoods',
    title: 'Operation Northwoods',
    subtitle: 'A documented 1962 proposal for staged pretexts against Cuba',
    category: 'secret-operations',
    status: 'historically_documented',
    tags: ['Cold War', 'Cuba', 'Pentagon', 'False flag'],
    image: '/media/cards/document.svg',
    summary:
      'In March 1962 the U.S. Joint Chiefs of Staff proposed staging or simulating attacks that could be blamed on Cuba in order to justify a military intervention. The proposal is documented in a declassified memorandum. It was not approved by the civilian leadership and was never carried out.',
    background:
      'After the failed Bay of Pigs invasion (April 1961) the Kennedy administration pursued covert pressure on the Cuban government under Operation Mongoose. Within this context the Joint Chiefs of Staff forwarded a set of pretext proposals to Secretary of Defense Robert McNamara.',
    origin:
      'The memorandum was declassified in 1997 by the Assassination Records Review Board as part of the review of records related to the Kennedy assassination. It became widely known after James Bamford described it in "Body of Secrets" (2001) and the National Security Archive published it online.',
    claims: [
      ['The Joint Chiefs of Staff sent a memorandum titled "Justification for US Military Intervention in Cuba" to the Secretary of Defense on 13 March 1962.', 'historically_documented', ['northwoods-memo', 'nsa-northwoods']],
      ['The proposals included staged incidents such as a simulated attack on a U.S. ship, fabricated incidents blamed on Cuba, and a staged "Remember the Maine" incident.', 'historically_documented', ['northwoods-memo']],
      ['The plan was approved and carried out.', 'debunked', [], 'No document or testimony shows that any of the Northwoods proposals were implemented; the civilian leadership did not approve them.', ['nsa-northwoods', 'bamford-body']],
      ['Northwoods proves that later disasters were "false flag" operations staged by the U.S. government.', 'unverified', [], 'A rejected 1962 proposal is not evidence about any other event. Each such claim needs its own independent evidence.', []],
    ],
    general: [['nara-jfk', 'context', 'The memorandum was released through the JFK records review.'], ['bamford-body', 'context', null]],
    de: {
      title: 'Operation Northwoods',
      subtitle: 'Ein dokumentierter Vorschlag von 1962 für inszenierte Vorwände gegen Kuba',
      summary:
        'Im März 1962 schlugen die Vereinigten Stabschefs der USA vor, Angriffe zu inszenieren oder vorzutäuschen, die Kuba angelastet werden könnten, um eine Militärintervention zu rechtfertigen. Der Vorschlag ist durch ein freigegebenes Memorandum belegt. Er wurde von der zivilen Führung nicht gebilligt und nie ausgeführt.',
      background:
        'Nach der gescheiterten Invasion in der Schweinebucht (April 1961) übte die Regierung Kennedy im Rahmen der Operation Mongoose verdeckten Druck auf die kubanische Regierung aus. In diesem Zusammenhang leiteten die Stabschefs Verteidigungsminister Robert McNamara eine Reihe von Vorwand-Vorschlägen zu.',
      claims: [
        'Die Vereinigten Stabschefs sandten am 13. März 1962 ein Memorandum mit dem Titel „Justification for US Military Intervention in Cuba“ an den Verteidigungsminister.',
        'Die Vorschläge umfassten inszenierte Zwischenfälle, etwa einen vorgetäuschten Angriff auf ein US-Schiff, Kuba angelastete erfundene Vorfälle und einen inszenierten „Remember the Maine“-Zwischenfall.',
        'Der Plan wurde genehmigt und ausgeführt.',
        'Northwoods beweise, dass spätere Katastrophen von der US-Regierung inszenierte „False-Flag“-Operationen waren.',
      ],
      counters: [
        'Kein Dokument und keine Aussage belegt, dass einer der Northwoods-Vorschläge umgesetzt wurde; die zivile Führung billigte sie nicht.',
        'Ein abgelehnter Vorschlag von 1962 ist kein Beleg für irgendein anderes Ereignis. Jede solche Behauptung braucht eigene, unabhängige Belege.',
      ],
    },
  },
  {
    key: 'mkultra',
    slug: 'mkultra',
    title: 'MKUltra',
    subtitle: "The CIA's covert program of behavioral modification research",
    category: 'intelligence-agencies',
    status: 'historically_documented',
    tags: ['CIA', 'LSD', 'Human experimentation', 'Cold War'],
    image: '/media/cards/agency.svg',
    summary:
      'MKUltra was a CIA research program, approved in 1953, that investigated drugs and other methods to influence human behavior, including experiments on people who had not given their consent. Its existence was confirmed by official investigations in the 1970s. Most of its records were destroyed in 1973.',
    background:
      'During the early Cold War, U.S. agencies feared that adversaries had developed interrogation and "brainwashing" techniques. The CIA funded research at universities, hospitals and prisons, often through front organizations, under a series of code-named projects of which MKUltra is the best known.',
    origin:
      "Public knowledge began with the Rockefeller Commission (1975) and the Church Committee (1975–1976). In 1977 about 20,000 surviving financial records were found and discussed at a Senate hearing.",
    claims: [
      ['The CIA operated a research program code-named MKUltra, approved in 1953, that studied drugs such as LSD and other behavior modification methods.', 'historically_documented', ['mkultra-hearing', 'church-book1']],
      ['Some people were given drugs without their knowledge or consent, including the scientist Frank Olson, who died in 1953.', 'historically_documented', ['rockefeller', 'church-book1']],
      ['Most MKUltra files were destroyed in 1973 on the order of CIA Director Richard Helms.', 'historically_documented', ['mkultra-hearing']],
      ['The CIA succeeded in creating reliable "mind-controlled" agents.', 'unverified', [], 'Surviving records and official testimony describe research with limited and inconsistent results. No documented evidence shows reliable mind control was achieved.', ['mkultra-hearing', 'kinzer']],
    ],
    general: [['kinzer', 'context', null]],
    de: {
      title: 'MKUltra',
      subtitle: 'Das verdeckte Forschungsprogramm der CIA zur Verhaltensbeeinflussung',
      summary:
        'MKUltra war ein 1953 genehmigtes Forschungsprogramm der CIA, das Drogen und andere Methoden zur Beeinflussung menschlichen Verhaltens untersuchte, darunter Experimente an Menschen ohne deren Einwilligung. Seine Existenz wurde in den 1970er-Jahren durch offizielle Untersuchungen bestätigt. Die meisten Akten wurden 1973 vernichtet.',
      background:
        'Im frühen Kalten Krieg fürchteten US-Behörden, Gegner hätten Verhör- und „Gehirnwäsche“-Techniken entwickelt. Die CIA finanzierte Forschung an Universitäten, Kliniken und Gefängnissen, oft über Tarnorganisationen, im Rahmen mehrerer Projekte, von denen MKUltra das bekannteste ist.',
      claims: [
        'Die CIA betrieb ein 1953 genehmigtes Forschungsprogramm mit dem Codenamen MKUltra, das Drogen wie LSD und andere Methoden der Verhaltensbeeinflussung untersuchte.',
        'Manchen Menschen wurden ohne ihr Wissen oder ihre Einwilligung Drogen verabreicht, darunter dem Wissenschaftler Frank Olson, der 1953 starb.',
        'Die meisten MKUltra-Akten wurden 1973 auf Anordnung von CIA-Direktor Richard Helms vernichtet.',
        'Die CIA habe zuverlässig „gedankengesteuerte“ Agenten erschaffen.',
      ],
      counters: [
        'Erhaltene Unterlagen und offizielle Aussagen beschreiben Forschung mit begrenzten und uneinheitlichen Ergebnissen. Kein Dokument belegt, dass zuverlässige Gedankenkontrolle erreicht wurde.',
      ],
    },
  },
  {
    key: 'watergate',
    slug: 'watergate',
    title: 'Watergate',
    subtitle: 'A documented political conspiracy that ended a presidency',
    category: 'politics-power',
    status: 'historically_documented',
    tags: ['Nixon', 'Cover-up', 'White House tapes', 'Journalism'],
    image: '/media/cards/document.svg',
    summary:
      "The 1972 break-in at the Democratic National Committee offices in the Watergate complex and the subsequent cover-up led to President Richard Nixon's resignation in August 1974. Watergate is a political conspiracy established by courts, Congress and the recorded White House tapes.",
    background:
      'During the 1972 presidential campaign, operatives linked to the Committee for the Re-Election of the President conducted espionage and sabotage against political opponents. The arrest of five burglars on 17 June 1972 began investigations by journalists, a special prosecutor, a federal grand jury and the Senate.',
    origin:
      "Reporting by The Washington Post, the televised Senate hearings of 1973 and the disclosure of Nixon's secret taping system turned the break-in into a constitutional crisis.",
    claims: [
      ['Five men were arrested inside the Democratic National Committee offices at the Watergate complex on 17 June 1972.', 'historically_documented', ['nara-watergate', 'senate-watergate-report']],
      ['The burglars were connected to the Committee for the Re-Election of the President.', 'historically_documented', ['senate-watergate-report']],
      ["President Nixon took part in the cover-up, as shown by the recorded conversation of 23 June 1972 (the \"smoking gun\" tape).", 'historically_documented', ['nixon-library', 'us-v-nixon']],
      ['The Supreme Court unanimously ordered the release of the White House tapes in United States v. Nixon (1974).', 'historically_documented', ['us-v-nixon']],
      ["The Washington Post's confidential source \"Deep Throat\" was FBI Associate Director Mark Felt.", 'historically_documented', ['felt-vanity']],
      ['The break-in served hidden purposes other than political espionage and was steered by other insiders.', 'disputed', ['silent-coup'], 'These revisionist accounts are contested, rest on disputed testimony, and were the subject of a defamation lawsuit by former White House counsel John Dean.', []],
    ],
    general: [['atpm', 'context', null]],
    de: {
      title: 'Watergate',
      subtitle: 'Eine dokumentierte politische Verschwörung, die eine Präsidentschaft beendete',
      summary:
        'Der Einbruch in die Büros des Democratic National Committee im Watergate-Komplex 1972 und die anschließende Vertuschung führten im August 1974 zum Rücktritt von Präsident Richard Nixon. Watergate ist eine politische Verschwörung, die durch Gerichte, den Kongress und die aufgezeichneten Tonbänder des Weißen Hauses belegt ist.',
      background:
        'Im Präsidentschaftswahlkampf 1972 betrieben Personen aus dem Umfeld des Committee for the Re-Election of the President Spionage und Sabotage gegen politische Gegner. Die Festnahme von fünf Einbrechern am 17. Juni 1972 löste Ermittlungen durch Journalisten, einen Sonderermittler, eine Grand Jury und den Senat aus.',
      claims: [
        'Am 17. Juni 1972 wurden fünf Männer in den Büros des Democratic National Committee im Watergate-Komplex festgenommen.',
        'Die Einbrecher standen in Verbindung mit dem Committee for the Re-Election of the President.',
        'Präsident Nixon war an der Vertuschung beteiligt, wie das aufgezeichnete Gespräch vom 23. Juni 1972 (das „smoking gun“-Band) zeigt.',
        'Der Oberste Gerichtshof ordnete in United States v. Nixon (1974) einstimmig die Herausgabe der Tonbänder an.',
        'Die vertrauliche Quelle „Deep Throat“ der Washington Post war der stellvertretende FBI-Direktor Mark Felt.',
        'Der Einbruch habe anderen, verborgenen Zwecken gedient und sei von anderen Insidern gesteuert worden.',
      ],
      counters: [
        'Diese revisionistischen Darstellungen sind umstritten, stützen sich auf strittige Aussagen und waren Gegenstand einer Verleumdungsklage des früheren Rechtsberaters des Weißen Hauses John Dean.',
      ],
    },
  },
  {
    key: 'area51',
    slug: 'area-51',
    title: 'Area 51',
    subtitle: 'A real secret test site and the extraterrestrial claims around it',
    category: 'space-ufos',
    status: 'unverified',
    tags: ['UFO', 'Nevada', 'U-2', 'OXCART', 'Aliens'],
    image: '/media/cards/location.svg',
    summary:
      'Area 51 at Groom Lake, Nevada, is a real and long-secret test facility used to develop reconnaissance aircraft such as the U-2 and the A-12 OXCART; its existence was officially acknowledged in 2013. Claims that it holds or studies extraterrestrial spacecraft remain unverified.',
    background:
      'In 1955 the CIA and the Air Force selected the remote dry lake bed at Groom Lake as a testing site for the U-2 spy plane. Later programs, including the A-12 OXCART, were also tested there. Strict secrecy around the base encouraged speculation.',
    origin:
      'The extraterrestrial narrative gained wide attention in 1989, when Bob Lazar claimed in a Las Vegas television interview that he had worked on alien craft at a nearby site called "S-4".',
    claims: [
      ['A secret test site at Groom Lake, Nevada, was used by the CIA and the Air Force to develop and test reconnaissance aircraft such as the U-2 and the A-12 OXCART.', 'historically_documented', ['cia-u2-history']],
      ["The U.S. government officially acknowledged the site in 2013 through the release of a declassified CIA history.", 'historically_documented', ['cia-u2-history']],
      ['Secret high-altitude reconnaissance flights explain a significant number of UFO reports from the 1950s and 1960s.', 'supported_by_evidence', ['cia-u2-history', 'haines-ufo']],
      ['Extraterrestrial spacecraft or beings are stored or studied at or near Area 51.', 'unverified', [], 'No verifiable evidence has been produced. A 2024 Department of Defense review found no evidence that any U.S. government program had extraterrestrial technology. Claimed academic credentials of the best-known witness could not be confirmed.', ['aaro-2024']],
    ],
    general: [['jacobsen', 'context', 'Popular history with disputed passages.']],
    de: {
      title: 'Area 51',
      subtitle: 'Ein realer geheimer Testort und die außerirdischen Behauptungen darum',
      summary:
        'Area 51 am Groom Lake in Nevada ist eine reale, lange geheim gehaltene Testanlage, in der Aufklärungsflugzeuge wie die U-2 und die A-12 OXCART entwickelt wurden; ihre Existenz wurde 2013 offiziell bestätigt. Behauptungen, dort würden außerirdische Raumschiffe aufbewahrt oder untersucht, sind unbelegt.',
      background:
        '1955 wählten CIA und Luftwaffe den abgelegenen ausgetrockneten Salzsee Groom Lake als Testgelände für das Spionageflugzeug U-2. Auch spätere Programme wie die A-12 OXCART wurden dort erprobt. Die strikte Geheimhaltung förderte Spekulationen.',
      claims: [
        'Ein geheimes Testgelände am Groom Lake in Nevada wurde von CIA und Luftwaffe genutzt, um Aufklärungsflugzeuge wie die U-2 und die A-12 OXCART zu entwickeln und zu testen.',
        'Die US-Regierung bestätigte das Gelände 2013 offiziell durch die Freigabe einer CIA-Geschichtsstudie.',
        'Geheime Höhenaufklärungsflüge erklären einen erheblichen Teil der UFO-Meldungen der 1950er- und 1960er-Jahre.',
        'In oder bei Area 51 würden außerirdische Raumschiffe oder Wesen aufbewahrt oder untersucht.',
      ],
      counters: [
        'Es wurden keine überprüfbaren Belege vorgelegt. Eine Untersuchung des US-Verteidigungsministeriums von 2024 fand keinen Hinweis darauf, dass ein Regierungsprogramm außerirdische Technologie besaß. Die angegebenen akademischen Abschlüsse des bekanntesten Zeugen ließen sich nicht bestätigen.',
      ],
    },
  },
  {
    key: 'moon',
    slug: 'moon-landing-conspiracy-theory',
    title: 'Moon Landing Conspiracy Theory',
    subtitle: 'The claim that the Apollo landings were faked',
    category: 'space-ufos',
    status: 'debunked',
    tags: ['Apollo', 'NASA', 'Space race', 'Hoax claim'],
    image: '/media/cards/technology.svg',
    summary:
      'The claim that NASA staged the Apollo Moon landings (1969–1972) appeared in the 1970s. It is contradicted by extensive independent evidence, including returned lunar samples, retroreflectors still used for laser ranging, independent tracking of the missions and orbital images of the landing sites.',
    background:
      'Between 1969 and 1972 six Apollo missions landed twelve astronauts on the Moon. The program took place during the Cold War space race with the Soviet Union, which tracked the missions closely.',
    origin:
      "Bill Kaysing's self-published book \"We Never Went to the Moon\" (1976) is one of the earliest publications of the claim. Television documentaries and, later, online videos spread it further.",
    claims: [
      ['Apollo 11 landed on the Moon on 20 July 1969 and returned its crew safely to Earth.', 'historically_documented', ['nasa-apollo11', 'lpi-apollo11']],
      ['The Moon landings were staged in a studio.', 'debunked', ['kaysing-book'], 'Retroreflectors placed by Apollo crews are still used for laser ranging, lunar samples have been studied by scientists worldwide, and orbital cameras have photographed the landing hardware and astronaut tracks.', ['dickey-llr', 'lroc', 'lpi-apollo11']],
      ['Photographs show inconsistencies (no stars, a "waving" flag, non-parallel shadows) that prove fakery.', 'debunked', ['kaysing-book'], 'Short camera exposures for the bright lunar surface do not capture faint stars; the flag was held by a horizontal rod and moved only when handled; shadows diverge because of perspective and uneven terrain.', ['lpi-apollo11']],
    ],
    general: [],
    de: {
      title: 'Verschwörungstheorie zur Mondlandung',
      subtitle: 'Die Behauptung, die Apollo-Landungen seien gefälscht',
      summary:
        'Die Behauptung, die NASA habe die Apollo-Mondlandungen (1969–1972) inszeniert, tauchte in den 1970er-Jahren auf. Ihr widersprechen umfangreiche unabhängige Belege, darunter zurückgebrachte Mondproben, noch heute für Laser-Entfernungsmessungen genutzte Reflektoren, unabhängige Verfolgung der Missionen und Orbitalaufnahmen der Landestellen.',
      background:
        'Zwischen 1969 und 1972 brachten sechs Apollo-Missionen zwölf Astronauten auf den Mond. Das Programm fand während des Wettlaufs ins All mit der Sowjetunion statt, die die Missionen genau beobachtete.',
      claims: [
        'Apollo 11 landete am 20. Juli 1969 auf dem Mond und brachte die Besatzung sicher zur Erde zurück.',
        'Die Mondlandungen seien in einem Studio inszeniert worden.',
        'Fotos zeigten Ungereimtheiten (keine Sterne, eine „wehende“ Flagge, nicht parallele Schatten), die eine Fälschung bewiesen.',
      ],
      counters: [
        'Von Apollo-Besatzungen aufgestellte Reflektoren werden bis heute für Laser-Entfernungsmessungen genutzt, Mondproben wurden weltweit wissenschaftlich untersucht, und Orbitalkameras haben Landegeräte und Fußspuren fotografiert.',
        'Kurze Belichtungszeiten für die helle Mondoberfläche erfassen keine schwachen Sterne; die Flagge hing an einer waagrechten Stange und bewegte sich nur bei Berührung; Schatten laufen wegen Perspektive und unebenem Gelände auseinander.',
      ],
    },
  },
  {
    key: 'illuminati',
    slug: 'illuminati-narratives',
    title: 'Illuminati Narratives',
    subtitle: 'From an 18th-century Bavarian society to a global myth',
    category: 'secret-organizations',
    status: 'unverified',
    tags: ['Secret society', 'Bavaria', 'Enlightenment', 'Freemasonry'],
    image: '/media/cards/organization.svg',
    summary:
      'The Order of the Illuminati was a real Enlightenment-era secret society founded in Bavaria in 1776 and suppressed by 1785. Claims that it survived and secretly controls world events are not supported by evidence.',
    background:
      'Adam Weishaupt, a professor at the University of Ingolstadt, founded the order to promote Enlightenment ideas against the influence of the church and absolutism. It recruited among the educated elite, partly through Masonic lodges, before Elector Karl Theodor banned unauthorized secret societies.',
    origin:
      'After the French Revolution, Augustin Barruel and John Robison (both 1797) blamed the revolution on a conspiracy involving the Illuminati. Variants of this narrative have circulated ever since and frequently overlap with antisemitic conspiracy myths.',
    claims: [
      ['The Order of the Illuminati was founded in Ingolstadt, Bavaria, on 1 May 1776 by Adam Weishaupt.', 'historically_documented', ['britannica-illuminati']],
      ['The order was suppressed by edicts of the Bavarian Elector Karl Theodor in 1784 and 1785.', 'historically_documented', ['britannica-illuminati']],
      ['The Illuminati secretly survived and orchestrated the French Revolution.', 'unverified', ['barruel-memoirs', 'robison-proofs'], 'Historians have found no evidence that the order remained active after its suppression. The French Revolution has extensively documented political, social and economic causes.', ['britannica-illuminati', 'barkun']],
      ['The Illuminati control governments, finance or the entertainment industry today.', 'unverified', [], 'No credible evidence supports this claim. The narrative is unfalsifiable by construction and has repeatedly been used to spread antisemitic conspiracy myths.', ['barkun']],
    ],
    general: [],
    de: {
      title: 'Illuminaten-Erzählungen',
      subtitle: 'Von einem bayerischen Geheimbund des 18. Jahrhunderts zum globalen Mythos',
      summary:
        'Der Illuminatenorden war ein realer Geheimbund der Aufklärung, 1776 in Bayern gegründet und bis 1785 verboten. Behauptungen, er habe überlebt und lenke heimlich das Weltgeschehen, sind nicht belegt.',
      background:
        'Adam Weishaupt, Professor an der Universität Ingolstadt, gründete den Orden, um Ideen der Aufklärung gegen den Einfluss von Kirche und Absolutismus zu fördern. Er warb unter der gebildeten Elite, teils über Freimaurerlogen, bevor Kurfürst Karl Theodor nicht genehmigte Geheimgesellschaften verbot.',
      claims: [
        'Der Illuminatenorden wurde am 1. Mai 1776 in Ingolstadt (Bayern) von Adam Weishaupt gegründet.',
        'Der Orden wurde durch Edikte des bayerischen Kurfürsten Karl Theodor 1784 und 1785 verboten.',
        'Die Illuminaten hätten heimlich überlebt und die Französische Revolution gesteuert.',
        'Die Illuminaten kontrollierten heute Regierungen, Finanzwelt oder Unterhaltungsindustrie.',
      ],
      counters: [
        'Historiker fanden keine Belege, dass der Orden nach dem Verbot aktiv blieb. Die Französische Revolution hat umfassend dokumentierte politische, soziale und wirtschaftliche Ursachen.',
        'Keine glaubwürdigen Belege stützen diese Behauptung. Die Erzählung ist konstruktionsbedingt nicht widerlegbar und wurde wiederholt zur Verbreitung antisemitischer Verschwörungsmythen genutzt.',
      ],
    },
  },
  {
    key: 'chemtrails',
    slug: 'chemtrail-claims',
    title: 'Chemtrail Claims',
    subtitle: 'The belief that aircraft trails are secret spraying',
    category: 'science-technology',
    status: 'debunked',
    tags: ['Contrails', 'Aviation', 'Geoengineering', 'Atmosphere'],
    image: '/media/cards/technology.svg',
    summary:
      'Chemtrail claims assert that long-lasting trails behind aircraft are chemical or biological agents sprayed deliberately. Atmospheric science explains persistent trails as condensation trails (contrails). A 2016 survey of 77 experts found no evidence of a secret large-scale spraying program.',
    background:
      'Aircraft engines emit water vapor and particles. In cold, humid air at cruising altitude this vapor condenses and freezes into ice crystals, forming contrails that can persist and spread into cirrus-like clouds.',
    origin:
      'Chemtrail claims spread in the late 1990s through talk radio and early internet forums and later via social media.',
    claims: [
      ['Aircraft produce condensation trails that can persist and spread for hours when the upper atmosphere is cold and humid.', 'historically_documented', ['epa-contrails']],
      ['Persistent trails are chemicals sprayed deliberately as part of a secret large-scale program.', 'debunked', [], 'In a peer-reviewed survey, 76 of 77 atmospheric chemists and geochemists reported that they had not encountered evidence of a secret large-scale spraying program; alleged evidence could be explained by other factors.', ['shearer-2016']],
      ['Solar geoengineering, such as injecting aerosols into the stratosphere, has been proposed in scientific literature.', 'historically_documented', ['royal-society-geo'], 'These are research proposals and assessments. No secret large-scale deployment is documented.', ['royal-society-geo']],
    ],
    general: [],
    de: {
      title: 'Chemtrail-Behauptungen',
      subtitle: 'Der Glaube, Kondensstreifen seien heimliches Sprühen',
      summary:
        'Chemtrail-Behauptungen besagen, langlebige Streifen hinter Flugzeugen seien absichtlich versprühte chemische oder biologische Stoffe. Die Atmosphärenforschung erklärt anhaltende Streifen als Kondensstreifen. Eine Umfrage unter 77 Fachleuten fand 2016 keine Belege für ein geheimes großflächiges Sprühprogramm.',
      background:
        'Flugzeugtriebwerke stoßen Wasserdampf und Partikel aus. In kalter, feuchter Luft in Reiseflughöhe kondensiert und gefriert dieser Dampf zu Eiskristallen und bildet Kondensstreifen, die bestehen bleiben und sich zu zirrusartigen Wolken ausbreiten können.',
      claims: [
        'Flugzeuge erzeugen Kondensstreifen, die bei kalter und feuchter oberer Atmosphäre stundenlang bestehen und sich ausbreiten können.',
        'Anhaltende Streifen seien Chemikalien, die im Rahmen eines geheimen großflächigen Programms absichtlich versprüht würden.',
        'Solares Geoengineering, etwa das Einbringen von Aerosolen in die Stratosphäre, wurde in der Fachliteratur vorgeschlagen.',
      ],
      counters: [
        'In einer begutachteten Umfrage gaben 76 von 77 Atmosphärenchemikern und Geochemikern an, keine Belege für ein geheimes großflächiges Sprühprogramm gefunden zu haben; angebliche Belege ließen sich anders erklären.',
        'Es handelt sich um Forschungsvorschläge und Bewertungen. Ein geheimer großflächiger Einsatz ist nicht dokumentiert.',
      ],
    },
  },
  {
    key: 'jfk',
    slug: 'jfk-related-conspiracy-narratives',
    title: 'JFK-related Conspiracy Narratives',
    subtitle: 'Competing accounts of the 1963 assassination',
    category: 'politics-power',
    status: 'disputed',
    tags: ['Kennedy', 'Dallas', 'Warren Commission', 'HSCA'],
    image: '/media/cards/person.svg',
    summary:
      "President John F. Kennedy was assassinated in Dallas on 22 November 1963. The Warren Commission (1964) concluded that Lee Harvey Oswald acted alone. The House Select Committee on Assassinations (1979) concluded that Kennedy was probably assassinated as a result of a conspiracy, a finding based largely on acoustic evidence that the National Academy of Sciences disputed in 1982.",
    background:
      'Oswald was arrested on the day of the assassination and shot dead two days later by Jack Ruby, so no trial took place. Gaps in the public record and long-classified files fuelled decades of alternative theories.',
    origin:
      'Critiques of the Warren Report appeared soon after 1964. Public interest grew after the HSCA findings and the 1991 film "JFK", which contributed to the JFK Records Act of 1992.',
    claims: [
      ['Kennedy was shot and killed in Dealey Plaza, Dallas, on 22 November 1963.', 'historically_documented', ['warren-report', 'hsca-report']],
      ['The Warren Commission concluded that Lee Harvey Oswald fired the shots and acted alone.', 'historically_documented', ['warren-report']],
      ['The HSCA concluded in 1979 that Kennedy was probably assassinated as a result of a conspiracy.', 'historically_documented', ['hsca-report']],
      ['A second gunman fired from the "grassy knoll".', 'disputed', ['hsca-report'], 'The National Academy of Sciences Committee on Ballistic Acoustics concluded in 1982 that the acoustic evidence did not show a shot from the knoll.', ['nas-acoustics']],
      ['The CIA, organized crime or other groups planned the assassination.', 'unverified', [], 'No official investigation has produced verified evidence for this. The HSCA found that the CIA, FBI and Secret Service were not involved, although it could not rule out involvement of individual members of certain groups.', ['hsca-report']],
    ],
    general: [['nara-jfk', 'context', 'Released records under the JFK Records Act.']],
    de: {
      title: 'Verschwörungserzählungen um JFK',
      subtitle: 'Konkurrierende Darstellungen des Attentats von 1963',
      summary:
        'Präsident John F. Kennedy wurde am 22. November 1963 in Dallas ermordet. Die Warren-Kommission (1964) kam zu dem Schluss, dass Lee Harvey Oswald allein handelte. Der Untersuchungsausschuss des Repräsentantenhauses (HSCA, 1979) folgerte, Kennedy sei wahrscheinlich infolge einer Verschwörung ermordet worden – gestützt vor allem auf akustische Belege, die die National Academy of Sciences 1982 bestritt.',
      background:
        'Oswald wurde am Tag des Attentats festgenommen und zwei Tage später von Jack Ruby erschossen, sodass kein Prozess stattfand. Lücken im öffentlichen Archiv und lange geheime Akten nährten jahrzehntelang alternative Theorien.',
      claims: [
        'Kennedy wurde am 22. November 1963 auf der Dealey Plaza in Dallas erschossen.',
        'Die Warren-Kommission kam zu dem Schluss, dass Lee Harvey Oswald die Schüsse abgab und allein handelte.',
        'Der HSCA folgerte 1979, Kennedy sei wahrscheinlich infolge einer Verschwörung ermordet worden.',
        'Ein zweiter Schütze habe vom „Grassy Knoll“ aus geschossen.',
        'Die CIA, das organisierte Verbrechen oder andere Gruppen hätten das Attentat geplant.',
      ],
      counters: [
        'Der Ausschuss für ballistische Akustik der National Academy of Sciences kam 1982 zu dem Schluss, dass die akustischen Belege keinen Schuss vom Knoll zeigen.',
        'Keine offizielle Untersuchung hat dafür überprüfte Belege erbracht. Der HSCA stellte fest, dass CIA, FBI und Secret Service nicht beteiligt waren, konnte aber die Beteiligung einzelner Mitglieder bestimmter Gruppen nicht ausschließen.',
      ],
    },
  },
];

// Events ---------------------------------------------------------------------------------------
export const events = [
  { key: 'illuminati-founded', title: 'Founding of the Order of the Illuminati', start: '1776-05-01', year: 1776, location: 'ingolstadt', category: 'secret-organizations', status: 'historically_documented', description: 'Adam Weishaupt founds the order in Ingolstadt.', de: ['Gründung des Illuminatenordens', 'Adam Weishaupt gründet den Orden in Ingolstadt.'] },
  { key: 'illuminati-ban', title: 'Bavarian edicts suppress secret societies', start: '1784', end: '1785', year: 1784, endYear: 1785, period: true, location: 'munich', category: 'secret-organizations', status: 'historically_documented', description: 'Elector Karl Theodor bans unauthorized societies; the 1785 edict names the Illuminati.', de: ['Bayerische Edikte verbieten Geheimgesellschaften', 'Kurfürst Karl Theodor verbietet nicht genehmigte Gesellschaften; das Edikt von 1785 nennt die Illuminaten.'] },
  { key: 'conspiracy-books-1797', title: 'Barruel and Robison publish Illuminati conspiracy books', start: '1797', year: 1797, location: null, category: 'history', status: 'historically_documented', description: 'Both authors blame the French Revolution on a secret conspiracy.', de: ['Barruel und Robison veröffentlichen Verschwörungsbücher', 'Beide Autoren machen eine geheime Verschwörung für die Französische Revolution verantwortlich.'] },
  { key: 'mkultra-approved', title: 'MKUltra approved', start: '1953-04-13', year: 1953, location: 'washington', category: 'intelligence-agencies', status: 'historically_documented', description: 'CIA Director Allen Dulles approves the program.', de: ['MKUltra genehmigt', 'CIA-Direktor Allen Dulles genehmigt das Programm.'] },
  { key: 'olson-death', title: 'Death of Frank Olson', start: '1953-11-28', year: 1953, location: 'new-york', category: 'intelligence-agencies', status: 'historically_documented', description: 'Olson dies in New York days after being covertly given LSD in a CIA experiment.', de: ['Tod von Frank Olson', 'Olson stirbt in New York, Tage nachdem ihm in einem CIA-Experiment heimlich LSD verabreicht wurde.'] },
  { key: 'groom-lake-selected', title: 'Groom Lake selected as U-2 test site', start: '1955', year: 1955, location: 'groom-lake', category: 'space-ufos', status: 'historically_documented', description: 'The CIA and the Air Force establish the remote test site later known as Area 51.', de: ['Groom Lake wird Testgelände für die U-2', 'CIA und Luftwaffe richten das abgelegene Testgelände ein, das später als Area 51 bekannt wird.'] },
  { key: 'u2-oxcart', title: 'U-2 and OXCART testing at Groom Lake', start: '1955', end: '1968', year: 1955, endYear: 1968, period: true, location: 'groom-lake', category: 'space-ufos', status: 'historically_documented', description: 'Development and testing of high-altitude reconnaissance aircraft.', de: ['Erprobung von U-2 und OXCART am Groom Lake', 'Entwicklung und Erprobung von Höhenaufklärungsflugzeugen.'] },
  { key: 'northwoods-memo', title: 'Northwoods memorandum submitted', start: '1962-03-13', year: 1962, location: 'pentagon', category: 'secret-operations', status: 'historically_documented', description: 'The Joint Chiefs of Staff forward pretext proposals to the Secretary of Defense.', de: ['Northwoods-Memorandum eingereicht', 'Die Stabschefs leiten dem Verteidigungsminister Vorwand-Vorschläge zu.'] },
  { key: 'jfk-assassination', title: 'Assassination of John F. Kennedy', start: '1963-11-22', year: 1963, location: 'dealey-plaza', category: 'politics-power', status: 'historically_documented', description: 'President Kennedy is shot in Dallas.', de: ['Ermordung von John F. Kennedy', 'Präsident Kennedy wird in Dallas erschossen.'] },
  { key: 'warren-report', title: 'Warren Commission report delivered', start: '1964-09-24', year: 1964, location: 'washington', category: 'politics-power', status: 'historically_documented', description: 'The commission concludes that Oswald acted alone.', de: ['Bericht der Warren-Kommission übergeben', 'Die Kommission folgert, dass Oswald allein handelte.'] },
  { key: 'apollo11', title: 'Apollo 11 mission', start: '1969-07-16', end: '1969-07-24', year: 1969, endYear: 1969, period: true, location: 'kennedy-space-center', category: 'space-ufos', status: 'historically_documented', description: 'Launch from Kennedy Space Center, Moon landing on 20 July, return on 24 July.', de: ['Apollo-11-Mission', 'Start vom Kennedy Space Center, Mondlandung am 20. Juli, Rückkehr am 24. Juli.'] },
  { key: 'watergate-breakin', title: 'Watergate break-in', start: '1972-06-17', year: 1972, location: 'watergate-complex', category: 'politics-power', status: 'historically_documented', description: 'Five men are arrested inside the DNC offices.', de: ['Watergate-Einbruch', 'Fünf Männer werden in den Büros des DNC festgenommen.'] },
  { key: 'mkultra-files-destroyed', title: 'MKUltra files destroyed', start: '1973', year: 1973, location: 'langley', category: 'intelligence-agencies', status: 'historically_documented', description: 'Most program records are destroyed on the order of Richard Helms.', de: ['MKUltra-Akten vernichtet', 'Die meisten Programmakten werden auf Anordnung von Richard Helms vernichtet.'] },
  { key: 'watergate-hearings', title: 'Senate Watergate hearings', start: '1973-05-17', year: 1973, location: 'washington', category: 'politics-power', status: 'historically_documented', description: 'Televised hearings of the Senate Select Committee begin.', de: ['Watergate-Anhörungen im Senat', 'Die im Fernsehen übertragenen Anhörungen des Senatsausschusses beginnen.'] },
  { key: 'us-v-nixon', title: 'United States v. Nixon', start: '1974-07-24', year: 1974, location: 'washington', category: 'politics-power', status: 'historically_documented', description: 'The Supreme Court orders the release of the White House tapes.', de: ['United States v. Nixon', 'Der Oberste Gerichtshof ordnet die Herausgabe der Tonbänder an.'] },
  { key: 'nixon-resigns', title: 'Nixon resigns', start: '1974-08-09', year: 1974, location: 'washington', category: 'politics-power', status: 'historically_documented', description: 'Richard Nixon becomes the first U.S. president to resign.', de: ['Rücktritt Nixons', 'Richard Nixon tritt als erster US-Präsident zurück.'] },
  { key: 'church-committee', title: 'Church Committee investigations', start: '1975', end: '1976', year: 1975, endYear: 1976, period: true, location: 'washington', category: 'intelligence-agencies', status: 'historically_documented', description: 'The Senate investigates abuses by U.S. intelligence agencies.', de: ['Untersuchungen des Church Committee', 'Der Senat untersucht Missstände bei US-Geheimdiensten.'] },
  { key: 'kaysing-book', title: "Publication of 'We Never Went to the Moon'", start: '1976', year: 1976, location: null, category: 'space-ufos', status: 'historically_documented', description: 'Bill Kaysing publishes one of the first Moon-hoax books.', de: ['Veröffentlichung von „We Never Went to the Moon“', 'Bill Kaysing veröffentlicht eines der ersten Bücher zur Mondlandungslüge.'] },
  { key: 'mkultra-hearing', title: 'Senate hearing on MKUltra', start: '1977-08-03', year: 1977, location: 'washington', category: 'intelligence-agencies', status: 'historically_documented', description: 'CIA Director Stansfield Turner testifies about surviving MKUltra records.', de: ['Senatsanhörung zu MKUltra', 'CIA-Direktor Stansfield Turner sagt über erhaltene MKUltra-Unterlagen aus.'] },
  { key: 'hsca-report', title: 'HSCA final report', start: '1979', year: 1979, location: 'washington', category: 'politics-power', status: 'historically_documented', description: "The committee concludes a 'probable conspiracy' in the Kennedy assassination.", de: ['Abschlussbericht des HSCA', 'Der Ausschuss folgert eine „wahrscheinliche Verschwörung“ beim Kennedy-Attentat.'] },
  { key: 'nas-acoustics', title: 'National Academy of Sciences acoustics report', start: '1982', year: 1982, location: 'washington', category: 'science-technology', status: 'historically_documented', description: 'Scientists reject the acoustic evidence used by the HSCA.', de: ['Akustik-Bericht der National Academy of Sciences', 'Wissenschaftler verwerfen die vom HSCA genutzten akustischen Belege.'] },
  { key: 'lazar-claims', title: 'Bob Lazar makes Area 51 claims', start: '1989', year: 1989, location: 'groom-lake', category: 'space-ufos', status: 'unverified', description: 'In a Las Vegas TV interview Lazar claims to have worked on alien craft. The content of the claims is unverified.', de: ['Bob Lazar äußert Behauptungen zu Area 51', 'In einem Fernsehinterview in Las Vegas behauptet Lazar, an außerirdischen Fluggeräten gearbeitet zu haben. Der Inhalt ist unbelegt.'] },
  { key: 'jfk-records-act', title: 'JFK Records Act signed', start: '1992-10-26', year: 1992, location: 'washington', category: 'politics-power', status: 'historically_documented', description: 'The law mandates the review and release of assassination records.', de: ['JFK Records Act unterzeichnet', 'Das Gesetz verlangt die Prüfung und Freigabe der Attentatsakten.'] },
  { key: 'northwoods-declassified', title: 'Northwoods memorandum declassified', start: '1997', year: 1997, location: 'washington', category: 'secret-operations', status: 'historically_documented', description: 'Released by the Assassination Records Review Board.', de: ['Northwoods-Memorandum freigegeben', 'Veröffentlicht durch das Assassination Records Review Board.'] },
  { key: 'chemtrail-spread', title: 'Chemtrail claims spread', start: '1997', end: '2000', year: 1997, endYear: 2000, period: true, location: null, category: 'internet-modern-myths', status: 'historically_documented', description: 'The claims circulate on talk radio and early internet forums.', de: ['Chemtrail-Behauptungen verbreiten sich', 'Die Behauptungen kursieren im Talk-Radio und in frühen Internetforen.'] },
  { key: 'epa-factsheet', title: 'EPA publishes contrails factsheet', start: '2000-09', year: 2000, location: 'washington', category: 'science-technology', status: 'historically_documented', description: 'Federal agencies explain how contrails form and persist.', de: ['EPA veröffentlicht Merkblatt zu Kondensstreifen', 'US-Behörden erklären Entstehung und Dauer von Kondensstreifen.'] },
  { key: 'felt-identified', title: "'Deep Throat' identified", start: '2005-05-31', year: 2005, location: null, category: 'politics-power', status: 'historically_documented', description: 'Mark Felt is revealed as the Washington Post source.', de: ['„Deep Throat“ enthüllt', 'Mark Felt wird als Quelle der Washington Post bekannt.'] },
  { key: 'lro-images', title: 'Orbital images of Apollo landing sites', start: '2009', year: 2009, location: null, category: 'space-ufos', status: 'historically_documented', description: 'The Lunar Reconnaissance Orbiter photographs Apollo landing hardware.', de: ['Orbitalaufnahmen der Apollo-Landestellen', 'Der Lunar Reconnaissance Orbiter fotografiert Apollo-Landegeräte.'] },
  { key: 'area51-acknowledged', title: 'CIA history acknowledges Area 51', start: '2013-08', year: 2013, location: 'groom-lake', category: 'space-ufos', status: 'historically_documented', description: 'A declassified CIA history is released after a FOIA request.', de: ['CIA-Studie bestätigt Area 51', 'Eine freigegebene CIA-Geschichtsstudie wird nach einem FOIA-Antrag veröffentlicht.'] },
  { key: 'shearer-study', title: 'Expert survey on chemtrail claims published', start: '2016-08', year: 2016, location: null, category: 'science-technology', status: 'historically_documented', description: '76 of 77 surveyed scientists report no evidence of secret spraying.', de: ['Expertenumfrage zu Chemtrails veröffentlicht', '76 von 77 befragten Wissenschaftlern finden keine Belege für heimliches Sprühen.'] },
  { key: 'aaro-report', title: 'AARO historical record report', start: '2024-03', year: 2024, location: 'pentagon', category: 'space-ufos', status: 'historically_documented', description: 'The Department of Defense finds no evidence of extraterrestrial technology in government programs.', de: ['AARO-Bericht zur historischen Aktenlage', 'Das Verteidigungsministerium findet keine Belege für außerirdische Technologie in Regierungsprogrammen.'] },
];

export const documents = [
  { key: 'northwoods-memo-doc', title: 'Northwoods memorandum (13 March 1962)', type: 'memorandum', source: 'northwoods-memo', archive: 'National Security Archive', license: 'U.S. government work (public domain); linked, not copied.' },
  { key: 'mkultra-hearing-doc', title: 'MKUltra Senate hearing transcript (1977)', type: 'hearing transcript', source: 'mkultra-hearing', archive: 'U.S. Senate Select Committee on Intelligence', license: 'U.S. government work (public domain); linked, not copied.' },
  { key: 'warren-report-doc', title: 'Warren Commission Report (1964)', type: 'report', source: 'warren-report', archive: 'U.S. National Archives', license: 'U.S. government work (public domain); linked, not copied.' },
  { key: 'hsca-report-doc', title: 'HSCA Final Report (1979)', type: 'report', source: 'hsca-report', archive: 'U.S. National Archives', license: 'U.S. government work (public domain); linked, not copied.' },
  { key: 'us-v-nixon-doc', title: 'United States v. Nixon opinion (1974)', type: 'court opinion', source: 'us-v-nixon', archive: 'Justia', license: 'U.S. court opinion (public domain); linked, not copied.' },
  { key: 'cia-u2-doc', title: 'CIA history of the U-2 and OXCART programs', type: 'report', source: 'cia-u2-history', archive: 'National Security Archive', license: 'U.S. government work (public domain); linked, not copied.' },
  { key: 'shearer-doc', title: 'Shearer et al. (2016), Environmental Research Letters', type: 'journal article', source: 'shearer-2016', archive: 'IOP Publishing', license: 'Open access (CC BY 3.0); linked, not copied.' },
];

// Relationships: [fromType, fromKey, toType, toKey, kind, verification, label]
export const relationships = [
  ['theory', 'northwoods', 'organization', 'jcs', 'documented', 'documented', 'Proposed by'],
  ['theory', 'northwoods', 'person', 'lemnitzer', 'documented', 'documented', 'Signed by'],
  ['theory', 'northwoods', 'event', 'northwoods-memo', 'documented', 'documented', null],
  ['theory', 'northwoods', 'event', 'northwoods-declassified', 'documented', 'documented', null],
  ['theory', 'northwoods', 'organization', 'arrb', 'documented', 'documented', 'Declassified by'],
  ['theory', 'northwoods', 'document', 'northwoods-memo-doc', 'documented', 'documented', null],
  ['theory', 'northwoods', 'location', 'havana', 'documented', 'documented', 'Target country'],
  ['theory', 'mkultra', 'organization', 'cia', 'documented', 'documented', 'Run by'],
  ['theory', 'mkultra', 'person', 'gottlieb', 'documented', 'documented', 'Program head'],
  ['theory', 'mkultra', 'person', 'helms', 'documented', 'documented', 'Ordered file destruction'],
  ['theory', 'mkultra', 'person', 'olson', 'documented', 'documented', 'Victim'],
  ['theory', 'mkultra', 'organization', 'church-committee', 'documented', 'documented', 'Investigated by'],
  ['theory', 'mkultra', 'event', 'mkultra-approved', 'documented', 'documented', null],
  ['theory', 'mkultra', 'event', 'olson-death', 'documented', 'documented', null],
  ['theory', 'mkultra', 'event', 'mkultra-files-destroyed', 'documented', 'documented', null],
  ['theory', 'mkultra', 'event', 'church-committee', 'documented', 'documented', null],
  ['theory', 'mkultra', 'event', 'mkultra-hearing', 'documented', 'documented', null],
  ['theory', 'mkultra', 'document', 'mkultra-hearing-doc', 'documented', 'documented', null],
  ['theory', 'watergate', 'organization', 'crp', 'documented', 'documented', 'Burglars linked to'],
  ['theory', 'watergate', 'person', 'nixon', 'documented', 'documented', 'Resigned'],
  ['theory', 'watergate', 'person', 'felt', 'documented', 'documented', "'Deep Throat'"],
  ['theory', 'watergate', 'organization', 'senate-watergate', 'documented', 'documented', 'Investigated by'],
  ['theory', 'watergate', 'event', 'watergate-breakin', 'documented', 'documented', null],
  ['theory', 'watergate', 'event', 'watergate-hearings', 'documented', 'documented', null],
  ['theory', 'watergate', 'event', 'us-v-nixon', 'documented', 'documented', null],
  ['theory', 'watergate', 'event', 'nixon-resigns', 'documented', 'documented', null],
  ['theory', 'watergate', 'event', 'felt-identified', 'documented', 'documented', null],
  ['theory', 'watergate', 'document', 'us-v-nixon-doc', 'documented', 'documented', null],
  ['theory', 'watergate', 'organization', 'church-committee', 'temporal', 'documented', 'Post-Watergate intelligence oversight'],
  ['theory', 'area51', 'organization', 'cia', 'documented', 'documented', 'Operated test site'],
  ['theory', 'area51', 'organization', 'usaf', 'documented', 'documented', 'Operates the site'],
  ['theory', 'area51', 'event', 'groom-lake-selected', 'documented', 'documented', null],
  ['theory', 'area51', 'event', 'u2-oxcart', 'documented', 'documented', null],
  ['theory', 'area51', 'event', 'area51-acknowledged', 'documented', 'documented', null],
  ['theory', 'area51', 'event', 'lazar-claims', 'claimed', 'documented', 'Origin of alien claims'],
  ['theory', 'area51', 'person', 'lazar', 'claimed', 'documented', 'Made unverified claims'],
  ['theory', 'area51', 'event', 'aaro-report', 'counter', 'documented', 'No evidence of alien technology'],
  ['theory', 'area51', 'document', 'cia-u2-doc', 'documented', 'documented', null],
  ['theory', 'area51', 'theory', 'moon', 'thematic', 'documented', 'Space & UFO narratives'],
  ['theory', 'moon', 'organization', 'nasa', 'documented', 'documented', 'Apollo program'],
  ['theory', 'moon', 'person', 'armstrong', 'documented', 'documented', 'Apollo 11 commander'],
  ['theory', 'moon', 'person', 'kaysing', 'claimed', 'documented', 'Originated the hoax claim'],
  ['theory', 'moon', 'event', 'apollo11', 'documented', 'documented', null],
  ['theory', 'moon', 'event', 'kaysing-book', 'claimed', 'documented', null],
  ['theory', 'moon', 'event', 'lro-images', 'counter', 'documented', 'Landing sites photographed'],
  ['theory', 'illuminati', 'organization', 'illuminati', 'documented', 'documented', 'Historical order'],
  ['theory', 'illuminati', 'person', 'weishaupt', 'documented', 'documented', 'Founder'],
  ['theory', 'illuminati', 'person', 'barruel', 'claimed', 'documented', 'Spread the conspiracy narrative'],
  ['theory', 'illuminati', 'person', 'robison', 'claimed', 'documented', 'Spread the conspiracy narrative'],
  ['theory', 'illuminati', 'event', 'illuminati-founded', 'documented', 'documented', null],
  ['theory', 'illuminati', 'event', 'illuminati-ban', 'documented', 'documented', null],
  ['theory', 'illuminati', 'event', 'conspiracy-books-1797', 'claimed', 'documented', null],
  ['theory', 'chemtrails', 'organization', 'epa', 'counter', 'documented', 'Contrails factsheet'],
  ['theory', 'chemtrails', 'event', 'chemtrail-spread', 'documented', 'documented', null],
  ['theory', 'chemtrails', 'event', 'epa-factsheet', 'counter', 'documented', null],
  ['theory', 'chemtrails', 'event', 'shearer-study', 'counter', 'documented', 'Expert survey'],
  ['theory', 'chemtrails', 'document', 'shearer-doc', 'counter', 'documented', null],
  ['theory', 'jfk', 'person', 'kennedy', 'documented', 'documented', 'Victim'],
  ['theory', 'jfk', 'person', 'oswald', 'documented', 'documented', 'Named as assassin'],
  ['theory', 'jfk', 'organization', 'warren-commission', 'documented', 'documented', 'Investigated'],
  ['theory', 'jfk', 'organization', 'hsca', 'documented', 'documented', 'Investigated'],
  ['theory', 'jfk', 'organization', 'arrb', 'documented', 'documented', 'Released records'],
  ['theory', 'jfk', 'organization', 'cia', 'claimed', 'suggested', 'Alleged involvement – not supported by HSCA findings'],
  ['theory', 'jfk', 'event', 'jfk-assassination', 'documented', 'documented', null],
  ['theory', 'jfk', 'event', 'warren-report', 'documented', 'documented', null],
  ['theory', 'jfk', 'event', 'hsca-report', 'documented', 'documented', null],
  ['theory', 'jfk', 'event', 'nas-acoustics', 'counter', 'documented', 'Disputes HSCA acoustic evidence'],
  ['theory', 'jfk', 'event', 'jfk-records-act', 'documented', 'documented', null],
  ['theory', 'jfk', 'document', 'warren-report-doc', 'documented', 'documented', null],
  ['theory', 'jfk', 'document', 'hsca-report-doc', 'documented', 'documented', null],
  ['theory', 'northwoods', 'theory', 'jfk', 'documented', 'documented', 'Released through the JFK records review'],
  ['person', 'lemnitzer', 'organization', 'jcs', 'documented', 'documented', 'Chairman'],
  ['person', 'gottlieb', 'organization', 'cia', 'documented', 'documented', 'Employee'],
  ['person', 'helms', 'organization', 'cia', 'documented', 'documented', 'Director'],
  ['person', 'armstrong', 'organization', 'nasa', 'documented', 'documented', 'Astronaut'],
  ['person', 'weishaupt', 'organization', 'illuminati', 'documented', 'documented', 'Founder'],
  ['organization', 'church-committee', 'organization', 'cia', 'documented', 'documented', 'Investigated'],
];
