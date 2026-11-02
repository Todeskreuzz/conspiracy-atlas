// French texts for the editorial archive. Same fields as the German translations in
// data/seed.mjs and data/cases-2.mjs. Sources, people and organisations stay in English.
// A reviewer should check these before the language goes live: they are a first translation,
// not a published editorial pass.

export const categories = {
  'politics-power': ['Politique et pouvoir', 'Gouvernements, élections, scandales et exercice du pouvoir politique.'],
  'secret-organizations': ['Organisations secrètes', 'Sociétés et ordres qui ont agi ou agiraient dans le secret.'],
  'intelligence-agencies': ['Services de renseignement', 'Programmes et opérations des services de renseignement.'],
  'space-ufos': ['Espace et OVNI', 'Vols spatiaux, phénomènes aériens non identifiés et affirmations qui s’y rapportent.'],
  'science-technology': ['Science et technologie', 'Programmes scientifiques, technologies et affirmations à leur sujet.'],
  history: ['Histoire', 'Événements historiques et leurs interprétations.'],
  'economy-finance': ['Économie et finance', 'Marchés, banques et pouvoir économique.'],
  'media-society': ['Médias et société', 'Médias de masse, propagande et opinion publique.'],
  'internet-modern-myths': ['Internet et mythes modernes', 'Récits nés ou diffusés en ligne.'],
  'secret-operations': ['Opérations secrètes', 'Plans et opérations clandestins, proposés ou exécutés.'],
};

export const theories = {
  'operation-northwoods': {
    title: 'Opération Northwoods',
    subtitle: 'Une proposition documentée de 1962 pour des prétextes mis en scène contre Cuba',
    summary:
      'En mars 1962, les chefs d’état-major américains ont proposé de monter ou de simuler des attaques que l’on pourrait attribuer à Cuba afin de justifier une intervention militaire. La proposition figure dans un mémorandum déclassifié. Elle n’a pas été approuvée par le pouvoir civil et n’a jamais été exécutée.',
    background:
      'Après l’échec du débarquement de la baie des Cochons (avril 1961), l’administration Kennedy a poursuivi une pression clandestine sur le gouvernement cubain dans le cadre de l’opération Mongoose. Dans ce contexte, les chefs d’état-major ont transmis un ensemble de propositions de prétextes au secrétaire à la Défense Robert McNamara.',
    claims: [
      'Les chefs d’état-major ont envoyé au secrétaire à la Défense, le 13 mars 1962, un mémorandum intitulé « Justification for US Military Intervention in Cuba ».',
      'Les propositions comprenaient des incidents mis en scène, comme une attaque simulée contre un navire américain, des incidents fabriqués attribués à Cuba, et un incident « Remember the Maine » monté de toutes pièces.',
      'Le plan a été approuvé et exécuté.',
      'Northwoods prouve que des catastrophes ultérieures étaient des opérations « sous faux drapeau » montées par le gouvernement américain.',
    ],
    counters: [
      'Aucun document ni aucun témoignage ne montre qu’une des propositions Northwoods a été mise en œuvre ; le pouvoir civil ne les a pas approuvées.',
      'Une proposition de 1962 rejetée ne prouve rien sur un autre événement. Chaque affirmation de ce genre exige ses propres preuves indépendantes.',
    ],
  },
  mkultra: {
    title: 'MKUltra',
    subtitle: 'Le programme clandestin de la CIA sur la modification du comportement',
    summary:
      'MKUltra était un programme de recherche de la CIA, approuvé en 1953, qui étudiait des drogues et d’autres méthodes pour influencer le comportement humain, y compris des expériences sur des personnes qui n’avaient pas donné leur consentement. Son existence a été confirmée par des enquêtes officielles dans les années 1970. La plupart de ses dossiers ont été détruits en 1973.',
    background:
      'Au début de la guerre froide, les agences américaines craignaient que des adversaires aient mis au point des techniques d’interrogatoire et de « lavage de cerveau ». La CIA a financé des recherches dans des universités, des hôpitaux et des prisons, souvent par des organisations-écrans, dans une série de projets dont MKUltra est le plus connu.',
    claims: [
      'La CIA a mené un programme de recherche nommé MKUltra, approuvé en 1953, qui étudiait des drogues comme le LSD et d’autres méthodes de modification du comportement.',
      'Certaines personnes ont reçu des drogues sans le savoir ni y consentir, dont le scientifique Frank Olson, mort en 1953.',
      'La plupart des dossiers MKUltra ont été détruits en 1973 sur ordre du directeur de la CIA Richard Helms.',
      'La CIA aurait réussi à créer des agents « sous contrôle mental » fiables.',
    ],
    counters: [
      'Les dossiers conservés et les témoignages officiels décrivent des recherches aux résultats limités et inconstants. Aucune preuve documentée ne montre qu’un contrôle mental fiable a été obtenu.',
    ],
  },
  watergate: {
    title: 'Watergate',
    subtitle: 'Un complot politique documenté qui a mis fin à une présidence',
    summary:
      'Le cambriolage de 1972 dans les bureaux du Comité national démocrate, au complexe du Watergate, et la dissimulation qui a suivi ont conduit à la démission du président Richard Nixon en août 1974. Le Watergate est un complot politique établi par les tribunaux, le Congrès et les enregistrements de la Maison-Blanche.',
    background:
      'Pendant la campagne présidentielle de 1972, des agents liés au comité pour la réélection du président ont mené espionnage et sabotage contre des adversaires politiques. L’arrestation de cinq cambrioleurs le 17 juin 1972 a lancé des enquêtes de journalistes, d’un procureur spécial, d’un grand jury fédéral et du Sénat.',
    claims: [
      'Cinq hommes ont été arrêtés dans les bureaux du Comité national démocrate, au complexe du Watergate, le 17 juin 1972.',
      'Les cambrioleurs étaient liés au comité pour la réélection du président.',
      'Le président Nixon a pris part à la dissimulation, comme le montre l’enregistrement du 23 juin 1972 (la bande dite « smoking gun »).',
      'La Cour suprême a ordonné à l’unanimité la remise des bandes de la Maison-Blanche dans l’arrêt United States v. Nixon (1974).',
      'La source confidentielle du Washington Post, « Deep Throat », était le directeur adjoint du FBI Mark Felt.',
      'Le cambriolage aurait servi d’autres buts cachés que l’espionnage politique et aurait été dirigé par d’autres initiés.',
    ],
    counters: [
      'Ces récits révisionnistes sont contestés, reposent sur des témoignages disputés et ont fait l’objet d’une action en diffamation de l’ancien conseiller de la Maison-Blanche John Dean.',
    ],
  },
  'area-51': {
    title: 'Zone 51',
    subtitle: 'Un vrai site d’essais secret et les affirmations extraterrestres qui l’entourent',
    summary:
      'La zone 51, à Groom Lake, au Nevada, est un vrai centre d’essais longtemps secret, utilisé pour mettre au point des avions de reconnaissance comme le U-2 et l’A-12 OXCART ; son existence a été officiellement reconnue en 2013. Les affirmations selon lesquelles on y conserverait ou étudierait des engins extraterrestres restent non vérifiées.',
    background:
      'En 1955, la CIA et l’armée de l’air ont choisi le lit de lac asséché et isolé de Groom Lake comme site d’essais pour l’avion-espion U-2. Des programmes ultérieurs, dont l’A-12 OXCART, y ont aussi été testés. Le secret strict autour de la base a nourri les spéculations.',
    claims: [
      'Un site d’essais secret à Groom Lake, au Nevada, a été utilisé par la CIA et l’armée de l’air pour mettre au point et tester des avions de reconnaissance comme le U-2 et l’A-12 OXCART.',
      'Le gouvernement américain a officiellement reconnu le site en 2013, par la publication d’une histoire déclassifiée de la CIA.',
      'Des vols secrets de reconnaissance à haute altitude expliquent une part importante des signalements d’OVNI des années 1950 et 1960.',
      'Des engins ou des êtres extraterrestres seraient conservés ou étudiés à la zone 51 ou à proximité.',
    ],
    counters: [
      'Aucune preuve vérifiable n’a été produite. Un examen du département de la Défense en 2024 n’a trouvé aucune preuve qu’un programme du gouvernement américain détenait une technologie extraterrestre. Les diplômes allégués du témoin le plus connu n’ont pas pu être confirmés.',
    ],
  },
  'moon-landing-conspiracy-theory': {
    title: 'Théorie du complot sur les alunissages',
    subtitle: 'L’affirmation selon laquelle les alunissages Apollo auraient été truqués',
    summary:
      'L’affirmation selon laquelle la NASA aurait mis en scène les alunissages Apollo (1969-1972) est apparue dans les années 1970. Elle est contredite par de nombreuses preuves indépendantes, dont des échantillons lunaires rapportés, des rétroréflecteurs encore utilisés pour la télémétrie laser, un suivi indépendant des missions et des images orbitales des sites d’alunissage.',
    background:
      'Entre 1969 et 1972, six missions Apollo ont posé douze astronautes sur la Lune. Le programme s’est déroulé pendant la course à l’espace de la guerre froide avec l’Union soviétique, qui suivait les missions de près.',
    claims: [
      'Apollo 11 s’est posée sur la Lune le 20 juillet 1969 et a ramené son équipage sain et sauf sur Terre.',
      'Les alunissages auraient été tournés en studio.',
      'Des photographies montreraient des incohérences (pas d’étoiles, un drapeau qui « flotte », des ombres non parallèles) qui prouveraient la supercherie.',
    ],
    counters: [
      'Les rétroréflecteurs posés par les équipages Apollo servent encore à la télémétrie laser, les échantillons lunaires ont été étudiés par des scientifiques du monde entier, et des caméras en orbite ont photographié le matériel d’alunissage et les traces des astronautes.',
      'Des poses courtes pour la surface lunaire très claire ne captent pas les étoiles faibles ; le drapeau était tenu par une barre horizontale et ne bougeait que lorsqu’on le manipulait ; les ombres divergent à cause de la perspective et d’un terrain inégal.',
    ],
  },
  'illuminati-narratives': {
    title: 'Récits sur les Illuminati',
    subtitle: 'D’une société bavaroise du XVIIIe siècle à un mythe mondial',
    summary:
      'L’ordre des Illuminati était une vraie société secrète des Lumières, fondée en Bavière en 1776 et supprimée vers 1785. Les affirmations selon lesquelles il aurait survécu et contrôlerait secrètement les événements du monde ne sont pas étayées.',
    background:
      'Adam Weishaupt, professeur à l’université d’Ingolstadt, a fondé l’ordre pour promouvoir les idées des Lumières contre l’influence de l’Église et de l’absolutisme. Il recrutait parmi les élites instruites, en partie par les loges maçonniques, avant que l’électeur Karl Theodor n’interdise les sociétés secrètes non autorisées.',
    claims: [
      'L’ordre des Illuminati a été fondé à Ingolstadt, en Bavière, le 1er mai 1776, par Adam Weishaupt.',
      'L’ordre a été interdit par le gouvernement bavarois en 1785.',
      'Les Illuminati auraient secrètement survécu et orchestré la Révolution française.',
      'Les Illuminati contrôleraient aujourd’hui les gouvernements, la finance ou l’industrie du divertissement.',
    ],
    counters: [
      'Les historiens n’ont trouvé aucune preuve que l’ordre soit resté actif après sa suppression. La Révolution française a des causes politiques, sociales et économiques abondamment documentées.',
      'Aucune preuve crédible n’appuie cette affirmation. Le récit est construit pour être irréfutable et a souvent servi à diffuser des mythes complotistes antisémites.',
    ],
  },
  'chemtrail-claims': {
    title: 'Affirmations sur les chemtrails',
    subtitle: 'La croyance que les traînées d’avions sont des épandages secrets',
    summary:
      'Les affirmations sur les chemtrails soutiennent que les traînées durables derrière les avions sont des agents chimiques ou biologiques épandus délibérément. La science de l’atmosphère explique les traînées persistantes comme des traînées de condensation. Une enquête de 2016 auprès de 77 experts n’a trouvé aucune preuve d’un programme secret d’épandage à grande échelle.',
    background:
      'Les moteurs d’avion émettent de la vapeur d’eau et des particules. Dans l’air froid et humide à l’altitude de croisière, cette vapeur se condense et gèle en cristaux de glace, formant des traînées qui peuvent persister et s’étaler en nuages proches des cirrus.',
    claims: [
      'Les avions produisent des traînées de condensation qui peuvent persister et s’étaler pendant des heures lorsque la haute atmosphère est froide et humide.',
      'Les traînées persistantes seraient des produits chimiques épandus délibérément dans un programme secret à grande échelle.',
      'La géo-ingénierie solaire, comme l’injection d’aérosols dans la stratosphère, a été proposée dans la littérature scientifique.',
    ],
    counters: [
      'Dans une enquête relue par des pairs, 76 chimistes de l’atmosphère et géochimistes sur 77 ont déclaré n’avoir rencontré aucune preuve d’un programme secret d’épandage à grande échelle ; les éléments présentés comme preuves s’expliquaient autrement.',
      'Il s’agit de propositions et d’évaluations de recherche. Aucun déploiement secret à grande échelle n’est documenté.',
    ],
  },
  'jfk-related-conspiracy-narratives': {
    title: 'Récits complotistes liés à JFK',
    subtitle: 'Des versions concurrentes de l’assassinat de 1963',
    summary:
      'Le président John F. Kennedy a été assassiné à Dallas le 22 novembre 1963. La commission Warren (1964) a conclu que Lee Harvey Oswald avait agi seul. La commission spéciale de la Chambre sur les assassinats (1979) a conclu que Kennedy avait probablement été assassiné dans le cadre d’un complot, conclusion fondée en grande partie sur des preuves acoustiques que l’Académie nationale des sciences a contestées en 1982.',
    background:
      'Oswald a été arrêté le jour de l’assassinat et tué par balle deux jours plus tard par Jack Ruby, si bien qu’il n’y a pas eu de procès. Des lacunes dans les archives publiques et des dossiers longtemps classifiés ont alimenté des décennies de théories alternatives.',
    claims: [
      'Kennedy a été abattu à Dealey Plaza, à Dallas, le 22 novembre 1963.',
      'La commission Warren a conclu que Lee Harvey Oswald avait tiré les coups de feu et agi seul.',
      'La HSCA a conclu en 1979 que Kennedy avait probablement été assassiné à la suite d’un complot.',
      'Un second tireur aurait tiré depuis la « colline herbeuse ».',
      'La CIA, le crime organisé ou d’autres groupes auraient planifié l’assassinat.',
    ],
    counters: [
      'Le comité d’acoustique balistique de l’Académie nationale des sciences a conclu en 1982 que les preuves acoustiques ne montraient pas un tir depuis la colline.',
      'Aucune enquête officielle n’a produit de preuve vérifiée de cela. La HSCA a estimé que la CIA, le FBI et les services secrets n’étaient pas impliqués, tout en ne pouvant pas exclure la participation de membres isolés de certains groupes.',
    ],
  },
  'tuskegee-syphilis-study': {
    title: 'Étude de Tuskegee sur la syphilis',
    subtitle: 'Quarante ans de traitement refusé par le service de santé publique américain',
    summary:
      'De 1932 à 1972, le service de santé publique des États-Unis a observé l’évolution de la syphilis non traitée chez des hommes noirs du comté de Macon, en Alabama. On ne leur a pas dit leur diagnostic et on ne les a pas soignés, même après que la pénicilline est devenue le traitement de référence. L’étude a pris fin après sa révélation par la presse en 1972.',
    background:
      'Environ 600 hommes y ont pris part : à peu près 400 atteints de syphilis et environ 200 sans, comme groupe témoin. On leur disait qu’on les soignait pour du « mauvais sang », et ils recevaient des repas gratuits, des examens et une assurance obsèques. Les chercheurs ont fait en sorte qu’ils ne soient pas soignés ailleurs.',
    claims: [
      'Le service de santé publique a observé la syphilis non traitée chez environ 600 hommes noirs en Alabama de 1932 à 1972, sans leur consentement éclairé.',
      'Le traitement a encore été refusé après que la pénicilline est devenue, dans les années 1940, le traitement de référence de la syphilis.',
      'Le scandale a conduit à de nouvelles règles pour la recherche sur les êtres humains, dont le National Research Act de 1974 et le rapport Belmont de 1979.',
      'Les hommes de l’étude de Tuskegee auraient été infectés délibérément par la syphilis.',
    ],
    counters: [
      'Les hommes avaient déjà la syphilis lorsqu’ils ont été recrutés. Des infections délibérées ont eu lieu dans d’autres expériences du service de santé publique, au Guatemala, de 1946 à 1948.',
    ],
  },
  cointelpro: {
    title: 'COINTELPRO',
    subtitle: 'Les programmes secrets du FBI contre des groupes politiques aux États-Unis',
    summary:
      'De 1956 à 1971, le FBI a mené une série de programmes de contre-espionnage, connus sous le nom de COINTELPRO, pour surveiller, infiltrer, discréditer et perturber des organisations politiques aux États-Unis. Les programmes ont été rendus publics après que des militants ont volé des dossiers dans un bureau du FBI en 1971, et ils ont été documentés en détail par la commission Church.',
    background:
      'Le premier programme, lancé en 1956, visait le Parti communiste des États-Unis. Des programmes ultérieurs ont visé le Socialist Workers Party, des groupes suprémacistes blancs, des organisations nationalistes noires et de droits civiques, ainsi que la Nouvelle Gauche. Les méthodes comprenaient des lettres anonymes, des articles de presse placés, des informateurs et des tentatives de provoquer des conflits entre groupes.',
    claims: [
      'Le FBI a mené de 1956 à 1971 des programmes de contre-espionnage pour surveiller, infiltrer, discréditer et perturber des organisations politiques à l’intérieur du pays.',
      'Les programmes ont été connus après le vol de dossiers au bureau du FBI de Media, en Pennsylvanie, en mars 1971.',
      'En 1964, le FBI a envoyé à Martin Luther King Jr. une lettre anonyme que lui et ses conseillers ont lue comme une incitation au suicide.',
      'COINTELPRO n’aurait jamais vraiment pris fin et continuerait inchangé aujourd’hui.',
    ],
    counters: [
      'Les programmes ont officiellement pris fin en 1971 ; des règles de contrôle et des commissions du renseignement au Congrès ont ensuite été créées. Les affirmations sur des opérations ultérieures doivent être jugées sur leurs propres preuves.',
    ],
  },
  'gulf-of-tonkin-incident': {
    title: 'Incident du golfe du Tonkin',
    subtitle: 'L’attaque qui n’a pas eu lieu et la résolution qui a suivi',
    summary:
      'En août 1964, les États-Unis ont signalé deux attaques de vedettes nord-vietnamiennes contre des destroyers américains dans le golfe du Tonkin. La première, le 2 août, a eu lieu. La seconde, signalée le 4 août, n’a très probablement pas eu lieu. Le Congrès a néanmoins adopté la résolution du golfe du Tonkin, qui est devenue la base juridique de l’escalade de la guerre du Vietnam.',
    background:
      'Le 2 août 1964, le destroyer USS Maddox, en patrouille de renseignement, a été attaqué par trois vedettes lance-torpilles nord-vietnamiennes. Dans la nuit du 4 août, le Maddox et l’USS Turner Joy ont signalé une seconde attaque par mauvais temps. Le président Johnson a ordonné des frappes aériennes le lendemain, et le 7 août le Congrès a adopté la résolution avec seulement deux voix contre au Sénat.',
    claims: [
      'Le 2 août 1964, des vedettes lance-torpilles nord-vietnamiennes ont attaqué le destroyer USS Maddox dans le golfe du Tonkin.',
      'La seconde attaque signalée le 4 août 1964 n’a pas eu lieu.',
      'Le Congrès a adopté la résolution du golfe du Tonkin le 7 août 1964 ; elle autorisait le président à employer la force armée en Asie du Sud-Est.',
      'Des responsables américains auraient sciemment inventé l’attaque du 4 août comme prétexte à la guerre.',
    ],
    counters: [
      'L’étude de la NSA montre que le renseignement d’origine électromagnétique a été mal exploité et présenté de façon sélective. Les historiens ne s’accordent pas sur le point de savoir si les décideurs savaient alors qu’il n’y avait pas eu d’attaque ; les premiers rapports des destroyers étaient confus plutôt qu’inventés.',
    ],
  },
  'operation-paperclip': {
    title: 'Opération Paperclip',
    subtitle: 'Comment les États-Unis ont recruté des scientifiques allemands après 1945',
    summary:
      'Après la Seconde Guerre mondiale, les États-Unis ont fait venir plus de 1 600 scientifiques, ingénieurs et techniciens allemands dans le cadre d’un programme connu sous le nom d’opération Paperclip. Parmi eux se trouvaient d’anciens membres du parti nazi et de la SS. Leur passé a souvent été minimisé pour qu’ils puissent travailler et immigrer.',
    background:
      'Le programme était géré par la Joint Intelligence Objectives Agency. Son but était d’utiliser le savoir-faire allemand en fusées, aviation, chimie et médecine, et de le soustraire à l’Union soviétique. La recrue la plus connue était Wernher von Braun, qui avait dirigé le programme de la fusée V-2 et a ensuite dirigé le développement de la fusée lunaire Saturn V.',
    claims: [
      'Les États-Unis ont recruté après 1945 plus de 1 600 scientifiques, ingénieurs et techniciens allemands, dont d’anciens membres du parti nazi et de la SS.',
      'Des responsables ont minimisé ou omis le passé nazi de certaines recrues dans leurs dossiers afin qu’elles puissent immigrer.',
      'L’ingénieur de Paperclip Arthur Rudolph, chef de projet de la Saturn V, a quitté les États-Unis en 1984 après une enquête sur son rôle à l’usine de travail forcé de Mittelwerk.',
      'D’anciens nazis auraient secrètement contrôlé la NASA et y auraient poursuivi un agenda caché.',
    ],
    counters: [
      'Des ingénieurs allemands ont occupé des postes élevés, surtout dans le programme de fusées à Huntsville, mais la NASA était une agence civile sous contrôle politique américain. Aucune preuve ne montre un agenda caché.',
    ],
  },
  'roswell-incident': {
    title: 'Incident de Roswell',
    subtitle: 'Une découverte de débris en 1947 et l’histoire de crash extraterrestre qu’elle est devenue',
    summary:
      'En juillet 1947, les forces aériennes de l’armée américaine à Roswell, au Nouveau-Mexique, ont annoncé avoir récupéré un « disque volant », puis ont corrigé cela le lendemain en parlant d’un ballon météo. Des décennies plus tard, l’événement est devenu l’histoire de crash extraterrestre la plus connue. Des enquêtes de l’armée de l’air dans les années 1990 ont rattaché les débris au projet Mogul, un programme secret de ballons.',
    background:
      'Un éleveur a trouvé des débris de feuille, de caoutchouc, de ruban et de bâtons sur un ranch au nord-ouest de Roswell. Le 8 juillet 1947, le service de presse de Roswell Army Air Field a publié sa déclaration sur un « disque volant » ; le lendemain, le commandant de la Eighth Air Force a présenté le matériel comme les restes d’un ballon météo. Le projet Mogul utilisait des trains de ballons pour écouter les essais nucléaires soviétiques et était alors secret.',
    claims: [
      'Le 8 juillet 1947, Roswell Army Air Field a annoncé la récupération d’un « disque volant », et la déclaration a été remplacée le lendemain par l’explication du ballon météo.',
      'Les débris provenaient d’un train de ballons secret du projet Mogul.',
      'Un engin extraterrestre se serait écrasé près de Roswell et les corps de son équipage auraient été récupérés.',
      'Certains dossiers administratifs de Roswell Army Air Field de cette période ont été détruits.',
      'Les dossiers détruits prouveraient la dissimulation d’un crash extraterrestre.',
    ],
    counters: [
      'Deux rapports de l’armée de l’air et un examen du département de la Défense en 2024 n’ont trouvé aucune preuve d’un engin extraterrestre. Les récits de corps sont apparus des décennies plus tard et correspondent à des essais des années 1950 avec des mannequins anthropomorphes et à des accidents sans lien.',
      'Le General Accounting Office n’a pas pu déterminer qui a détruit les dossiers ni pourquoi. Leur perte, à elle seule, ne prouve pas ce qui s’est passé en 1947.',
    ],
  },
  'reichstag-fire': {
    title: 'Incendie du Reichstag',
    subtitle: 'Qui a mis le feu au parlement allemand en 1933 ?',
    summary:
      'Dans la nuit du 27 février 1933, le bâtiment du Reichstag à Berlin a brûlé. Le communiste de conseil néerlandais Marinus van der Lubbe a été arrêté sur place. Le nouveau gouvernement nazi a utilisé l’incendie pour suspendre les droits fondamentaux dès le lendemain. Savoir si van der Lubbe a agi seul ou si les nazis étaient impliqués reste débattu par les historiens.',
    background:
      'Adolf Hitler avait été nommé chancelier quatre semaines plus tôt. Le 28 février, le président Hindenburg a signé le décret de l’incendie du Reichstag, qui suspendait la liberté de la presse, de réunion et d’expression et permettait des arrestations sans procès. Des milliers de communistes et d’autres opposants ont été internés dans les semaines suivantes, peu avant l’élection du 5 mars 1933.',
    claims: [
      'Le bâtiment du Reichstag a brûlé dans la nuit du 27 février 1933 et Marinus van der Lubbe a été arrêté à l’intérieur.',
      'Le lendemain, le décret de l’incendie du Reichstag a suspendu les droits fondamentaux ; il a servi à persécuter les communistes et d’autres opposants.',
      'L’incendie faisait partie d’un soulèvement communiste planifié, comme l’affirmait le gouvernement nazi.',
      'Van der Lubbe a mis le feu seul.',
      'Les nazis auraient eux-mêmes allumé l’incendie pour s’emparer du pouvoir.',
    ],
    counters: [
      'Aucune preuve d’un soulèvement planifié n’a été trouvée, et le tribunal de Leipzig a acquitté les quatre coaccusés communistes en décembre 1933.',
      'Certains historiens estiment que l’ampleur de l’incendie et les circonstances indiquent des complices ; la question n’est pas tranchée.',
      'Aucun document direct ne prouve que les nazis ont allumé l’incendie. Des historiens comme Fritz Tobias et Hans Mommsen ont plaidé pour un auteur isolé ; le débat continue.',
    ],
  },
};

export const events = {
  'illuminati-founded': ['Fondation de l’ordre des Illuminati', 'Adam Weishaupt fonde l’ordre à Ingolstadt.'],
  'illuminati-ban': ['Des édits bavarois répriment les sociétés secrètes', 'L’électeur Karl Theodor interdit les sociétés non autorisées ; l’édit de 1785 nomme les Illuminati.'],
  'conspiracy-books-1797': ['Barruel et Robison publient des livres sur un complot des Illuminati', 'Les deux auteurs attribuent la Révolution française à un complot secret.'],
  'mkultra-approved': ['Approbation de MKUltra', 'Le directeur de la CIA Allen Dulles approuve le programme.'],
  'olson-death': ['Mort de Frank Olson', 'Olson meurt à New York quelques jours après avoir reçu du LSD à son insu dans une expérience de la CIA.'],
  'groom-lake-selected': ['Groom Lake choisi comme site d’essais du U-2', 'La CIA et l’armée de l’air établissent le site isolé plus tard connu comme la zone 51.'],
  'u2-oxcart': ['Essais du U-2 et d’OXCART à Groom Lake', 'Développement et essais d’avions de reconnaissance à haute altitude.'],
  'northwoods-memo': ['Remise du mémorandum Northwoods', 'Les chefs d’état-major transmettent des propositions de prétextes au secrétaire à la Défense.'],
  'jfk-assassination': ['Assassinat de John F. Kennedy', 'Le président Kennedy est abattu à Dallas.'],
  'warren-report': ['Remise du rapport de la commission Warren', 'La commission conclut qu’Oswald a agi seul.'],
  apollo11: ['Mission Apollo 11', 'Lancement depuis le centre spatial Kennedy, alunissage le 20 juillet, retour le 24 juillet.'],
  'watergate-breakin': ['Cambriolage du Watergate', 'Cinq hommes sont arrêtés dans les bureaux du Comité national démocrate.'],
  'mkultra-files-destroyed': ['Destruction des dossiers MKUltra', 'La plupart des dossiers du programme sont détruits sur ordre de Richard Helms.'],
  'watergate-hearings': ['Auditions du Sénat sur le Watergate', 'Début des auditions télévisées de la commission spéciale du Sénat.'],
  'us-v-nixon': ['United States v. Nixon', 'La Cour suprême ordonne la remise des bandes de la Maison-Blanche.'],
  'nixon-resigns': ['Démission de Nixon', 'Richard Nixon devient le premier président des États-Unis à démissionner.'],
  'church-committee': ['Enquêtes de la commission Church', 'Le Sénat enquête sur les abus des services de renseignement américains.'],
  'kaysing-book': ['Publication de « We Never Went to the Moon »', 'Bill Kaysing publie l’un des premiers livres sur le canular lunaire.'],
  'mkultra-hearing': ['Audition du Sénat sur MKUltra', 'Le directeur de la CIA Stansfield Turner témoigne sur les dossiers MKUltra conservés.'],
  'hsca-report': ['Rapport final de la HSCA', 'La commission conclut à un « complot probable » dans l’assassinat de Kennedy.'],
  'nas-acoustics': ['Rapport d’acoustique de l’Académie nationale des sciences', 'Des scientifiques rejettent les preuves acoustiques utilisées par la HSCA.'],
  'lazar-claims': ['Bob Lazar formule des affirmations sur la zone 51', 'Dans une interview télévisée à Las Vegas, Lazar affirme avoir travaillé sur des engins extraterrestres. Le contenu de ces affirmations n’est pas vérifié.'],
  'jfk-records-act': ['Signature du JFK Records Act', 'La loi impose l’examen et la publication des dossiers sur l’assassinat.'],
  'northwoods-declassified': ['Déclassification du mémorandum Northwoods', 'Publié par l’Assassination Records Review Board.'],
  'chemtrail-spread': ['Diffusion des affirmations sur les chemtrails', 'Les affirmations circulent à la radio parlée et sur les premiers forums internet.'],
  'epa-factsheet': ['L’EPA publie une fiche sur les traînées de condensation', 'Des agences fédérales expliquent comment les traînées se forment et persistent.'],
  'felt-identified': ['Identification de « Deep Throat »', 'Mark Felt est révélé comme la source du Washington Post.'],
  'lro-images': ['Images orbitales des sites d’alunissage Apollo', 'Le Lunar Reconnaissance Orbiter photographie le matériel des alunissages Apollo.'],
  'area51-acknowledged': ['Une histoire de la CIA reconnaît la zone 51', 'Une histoire déclassifiée de la CIA est publiée après une demande FOIA.'],
  'shearer-study': ['Publication d’une enquête d’experts sur les chemtrails', '76 scientifiques interrogés sur 77 ne signalent aucune preuve d’un épandage secret.'],
  'aaro-report': ['Rapport historique de l’AARO', 'Le département de la Défense ne trouve aucune preuve de technologie extraterrestre dans les programmes gouvernementaux.'],
  'tuskegee-begins': ['Début de l’étude de Tuskegee sur la syphilis', 'Le service de santé publique commence à observer la syphilis non traitée chez des hommes noirs du comté de Macon.'],
  'tuskegee-exposed': ['L’étude de Tuskegee révélée par la presse', 'Un article d’Associated Press de Jean Heller rend l’étude publique ; elle prend fin plus tard dans l’année.'],
  'belmont-report': ['Publication du rapport Belmont', 'Une commission nationale énonce des principes éthiques pour la recherche sur les êtres humains.'],
  'tuskegee-apology': ['Excuses présidentielles pour l’étude de Tuskegee', 'Le président Bill Clinton présente des excuses aux survivants et à leurs familles.'],
  'cointelpro-begins': ['Début du premier programme COINTELPRO', 'Le FBI lance un programme de contre-espionnage contre le Parti communiste des États-Unis.'],
  'media-burglary': ['Cambriolage du bureau du FBI à Media', 'Des militants volent des dossiers au bureau local du FBI et les envoient à des journaux.'],
  'cointelpro-ends': ['Fin officielle de COINTELPRO', 'J. Edgar Hoover ordonne la fin des programmes de contre-espionnage.'],
  'tonkin-aug2': ['Attaque contre l’USS Maddox', 'Trois vedettes lance-torpilles nord-vietnamiennes attaquent le destroyer USS Maddox.'],
  'tonkin-aug4': ['Seconde attaque signalée dans le golfe du Tonkin', 'Deux destroyers américains signalent une attaque par mauvais temps ; une analyse ultérieure montre qu’elle n’a pas eu lieu.'],
  'tonkin-resolution': ['Adoption de la résolution du golfe du Tonkin', 'Le Congrès autorise le président à employer la force armée en Asie du Sud-Est.'],
  'hanyok-released': ['La NSA publie l’étude sur le golfe du Tonkin', 'La NSA déclassifie l’étude de Robert J. Hanyok qui conclut que l’attaque du 4 août n’a pas eu lieu.'],
  'paperclip-begins': ['Premiers scientifiques allemands amenés aux États-Unis', 'Wernher von Braun et d’autres ingénieurs des fusées arrivent aux États-Unis.'],
  'saturn-v-first-flight': ['Premier vol de la Saturn V', 'La mission Apollo 4, sans équipage, lance la fusée lunaire mise au point sous von Braun.'],
  'rudolph-leaves': ['Arthur Rudolph quitte les États-Unis', 'L’ancien responsable de la Saturn V part après une enquête sur son rôle pendant la guerre.'],
  'roswell-press-release': ['Communiqué de Roswell sur un « disque volant »', 'Roswell Army Air Field annonce un « disque volant » récupéré ; l’explication du ballon météo suit le lendemain.'],
  'roswell-book': ['Publication de « The Roswell Incident »', 'Charles Berlitz et William L. Moore popularisent le récit du crash extraterrestre.'],
  'roswell-reports': ['Rapports de l’armée de l’air sur Roswell', 'L’armée de l’air attribue les débris au projet Mogul et les récits de corps à des essais ultérieurs de mannequins.'],
  'reichstag-fire': ['Incendie du Reichstag', 'Le bâtiment du Reichstag brûle ; Marinus van der Lubbe est arrêté à l’intérieur.'],
  'reichstag-decree': ['Décret de l’incendie du Reichstag', 'Le président Hindenburg suspend les droits fondamentaux par décret d’urgence.'],
  'reichstag-trial': ['Procès de l’incendie du Reichstag à Leipzig', 'Van der Lubbe est condamné à mort ; les quatre coaccusés communistes sont acquittés.'],
};
