// Spanish texts for the editorial archive. Same fields as the German translations in
// data/seed.mjs and data/cases-2.mjs. Sources, people and organisations stay in English.
// A reviewer should check these before the language goes live: they are a first translation,
// not a published editorial pass.

export const categories = {
  'politics-power': ['Política y poder', 'Gobiernos, elecciones, escándalos y el uso del poder político.'],
  'secret-organizations': ['Organizaciones secretas', 'Sociedades y órdenes que actuaron o se dice que actúan en secreto.'],
  'intelligence-agencies': ['Servicios de inteligencia', 'Programas y operaciones de los servicios de inteligencia.'],
  'space-ufos': ['Espacio y ovnis', 'Vuelos espaciales, fenómenos aéreos no identificados y afirmaciones relacionadas.'],
  'science-technology': ['Ciencia y tecnología', 'Programas científicos, tecnologías y afirmaciones sobre ellos.'],
  history: ['Historia', 'Hechos históricos y sus interpretaciones.'],
  'economy-finance': ['Economía y finanzas', 'Mercados, banca y poder económico.'],
  'media-society': ['Medios y sociedad', 'Medios de masas, propaganda y opinión pública.'],
  'internet-modern-myths': ['Internet y mitos modernos', 'Relatos que nacieron o se difundieron en línea.'],
  'secret-operations': ['Operaciones secretas', 'Planes y operaciones encubiertos, propuestos o ejecutados.'],
};

export const theories = {
  'operation-northwoods': {
    title: 'Operación Northwoods',
    subtitle: 'Una propuesta documentada de 1962 de pretextos simulados contra Cuba',
    summary:
      'En marzo de 1962, los jefes del Estado Mayor de Estados Unidos propusieron montar o simular ataques que pudieran atribuirse a Cuba para justificar una intervención militar. La propuesta está documentada en un memorando desclasificado. El poder civil no la aprobó y nunca se llevó a cabo.',
    background:
      'Tras el fracaso de la invasión de bahía de Cochinos (abril de 1961), la administración Kennedy mantuvo la presión encubierta sobre el gobierno cubano en el marco de la operación Mangosta. En ese contexto, los jefes del Estado Mayor enviaron un conjunto de propuestas de pretexto al secretario de Defensa Robert McNamara.',
    claims: [
      'Los jefes del Estado Mayor enviaron al secretario de Defensa, el 13 de marzo de 1962, un memorando titulado «Justification for US Military Intervention in Cuba».',
      'Las propuestas incluían incidentes simulados, como un ataque fingido contra un barco estadounidense, incidentes fabricados atribuidos a Cuba y un incidente «Remember the Maine» montado.',
      'El plan fue aprobado y se llevó a cabo.',
      'Northwoods prueba que desastres posteriores fueron operaciones de «falsa bandera» montadas por el gobierno de Estados Unidos.',
    ],
    counters: [
      'Ningún documento ni testimonio muestra que se ejecutara alguna de las propuestas de Northwoods; el poder civil no las aprobó.',
      'Una propuesta de 1962 rechazada no es prueba de ningún otro hecho. Cada afirmación de ese tipo necesita sus propias pruebas independientes.',
    ],
  },
  mkultra: {
    title: 'MKUltra',
    subtitle: 'El programa encubierto de la CIA de investigación sobre la modificación de la conducta',
    summary:
      'MKUltra fue un programa de investigación de la CIA, aprobado en 1953, que estudió drogas y otros métodos para influir en la conducta humana, incluidos experimentos con personas que no habían dado su consentimiento. Investigaciones oficiales de los años setenta confirmaron su existencia. La mayor parte de sus expedientes se destruyó en 1973.',
    background:
      'Al comienzo de la Guerra Fría, las agencias estadounidenses temían que los adversarios hubieran desarrollado técnicas de interrogatorio y de «lavado de cerebro». La CIA financió investigación en universidades, hospitales y prisiones, a menudo a través de organizaciones pantalla, en una serie de proyectos de los que MKUltra es el más conocido.',
    claims: [
      'La CIA dirigió un programa de investigación llamado MKUltra, aprobado en 1953, que estudió drogas como el LSD y otros métodos de modificación de la conducta.',
      'A algunas personas se les administraron drogas sin su conocimiento ni consentimiento, entre ellas el científico Frank Olson, que murió en 1953.',
      'La mayor parte de los expedientes de MKUltra se destruyó en 1973 por orden del director de la CIA Richard Helms.',
      'La CIA habría logrado crear agentes «controlados mentalmente» de forma fiable.',
    ],
    counters: [
      'Los expedientes conservados y los testimonios oficiales describen una investigación con resultados limitados e irregulares. Ninguna prueba documentada muestra que se lograra un control mental fiable.',
    ],
  },
  watergate: {
    title: 'Watergate',
    subtitle: 'Una conspiración política documentada que acabó con una presidencia',
    summary:
      'El allanamiento de 1972 en las oficinas del Comité Nacional Demócrata, en el complejo Watergate, y el encubrimiento posterior llevaron a la dimisión del presidente Richard Nixon en agosto de 1974. Watergate es una conspiración política establecida por los tribunales, el Congreso y las grabaciones de la Casa Blanca.',
    background:
      'Durante la campaña presidencial de 1972, agentes vinculados al comité para la reelección del presidente realizaron espionaje y sabotaje contra adversarios políticos. La detención de cinco intrusos el 17 de junio de 1972 inició investigaciones de periodistas, un fiscal especial, un gran jurado federal y el Senado.',
    claims: [
      'El 17 de junio de 1972 detuvieron a cinco hombres dentro de las oficinas del Comité Nacional Demócrata, en el complejo Watergate.',
      'Los intrusos estaban vinculados al comité para la reelección del presidente.',
      'El presidente Nixon participó en el encubrimiento, como muestra la conversación grabada del 23 de junio de 1972 (la cinta llamada «smoking gun»).',
      'El Tribunal Supremo ordenó por unanimidad la entrega de las cintas de la Casa Blanca en United States v. Nixon (1974).',
      'La fuente confidencial del Washington Post, «Deep Throat», era el director adjunto del FBI Mark Felt.',
      'El allanamiento habría servido a fines ocultos distintos del espionaje político y lo habrían dirigido otros iniciados.',
    ],
    counters: [
      'Estos relatos revisionistas están en disputa, se apoyan en testimonios discutidos y fueron objeto de una demanda por difamación del antiguo asesor de la Casa Blanca John Dean.',
    ],
  },
  'area-51': {
    title: 'Área 51',
    subtitle: 'Un centro de pruebas secreto real y las afirmaciones extraterrestres que lo rodean',
    summary:
      'El Área 51, en Groom Lake (Nevada), es un centro de pruebas real y durante mucho tiempo secreto, usado para desarrollar aviones de reconocimiento como el U-2 y el A-12 OXCART; su existencia se reconoció oficialmente en 2013. Las afirmaciones de que allí se guardan o estudian naves extraterrestres siguen sin verificar.',
    background:
      'En 1955, la CIA y la Fuerza Aérea eligieron el lecho seco y remoto de Groom Lake como lugar de pruebas del avión espía U-2. Programas posteriores, entre ellos el A-12 OXCART, también se probaron allí. El secreto estricto en torno a la base alimentó las especulaciones.',
    claims: [
      'Un centro de pruebas secreto en Groom Lake (Nevada) fue usado por la CIA y la Fuerza Aérea para desarrollar y probar aviones de reconocimiento como el U-2 y el A-12 OXCART.',
      'El gobierno de Estados Unidos reconoció oficialmente el lugar en 2013, al publicar una historia desclasificada de la CIA.',
      'Los vuelos secretos de reconocimiento a gran altitud explican una parte importante de los avisos de ovnis de los años cincuenta y sesenta.',
      'En el Área 51 o en sus inmediaciones se guardarían o estudiarían naves o seres extraterrestres.',
    ],
    counters: [
      'No se ha presentado ninguna prueba verificable. Una revisión del Departamento de Defensa de 2024 no halló pruebas de que ningún programa del gobierno de Estados Unidos tuviera tecnología extraterrestre. No se pudieron confirmar las credenciales académicas alegadas del testigo más conocido.',
    ],
  },
  'moon-landing-conspiracy-theory': {
    title: 'Teoría de la conspiración del alunizaje',
    subtitle: 'La afirmación de que los alunizajes del Apolo fueron un montaje',
    summary:
      'La afirmación de que la NASA escenificó los alunizajes del Apolo (1969-1972) apareció en los años setenta. La contradicen abundantes pruebas independientes, entre ellas muestras lunares traídas, retrorreflectores que aún se usan para telemetría láser, el seguimiento independiente de las misiones e imágenes orbitales de los lugares de alunizaje.',
    background:
      'Entre 1969 y 1972, seis misiones Apolo posaron a doce astronautas en la Luna. El programa se desarrolló durante la carrera espacial de la Guerra Fría con la Unión Soviética, que seguía las misiones de cerca.',
    claims: [
      'El Apolo 11 alunizó el 20 de julio de 1969 y devolvió a su tripulación sana y salva a la Tierra.',
      'Los alunizajes se habrían rodado en un estudio.',
      'Las fotografías mostrarían incoherencias (sin estrellas, una bandera que «ondea», sombras no paralelas) que probarían el fraude.',
    ],
    counters: [
      'Los retrorreflectores colocados por las tripulaciones del Apolo se siguen usando para telemetría láser, científicos de todo el mundo han estudiado las muestras lunares y cámaras en órbita han fotografiado el material de alunizaje y las huellas de los astronautas.',
      'Las exposiciones cortas para la superficie lunar, muy brillante, no captan estrellas tenues; la bandera se sostenía con una barra horizontal y solo se movía al manipularla; las sombras divergen por la perspectiva y el terreno irregular.',
    ],
  },
  'illuminati-narratives': {
    title: 'Relatos sobre los Illuminati',
    subtitle: 'De una sociedad bávara del siglo XVIII a un mito mundial',
    summary:
      'La orden de los Illuminati fue una sociedad secreta real de la Ilustración, fundada en Baviera en 1776 y suprimida hacia 1785. Las afirmaciones de que sobrevivió y controla en secreto los acontecimientos del mundo no están respaldadas.',
    background:
      'Adam Weishaupt, profesor de la universidad de Ingolstadt, fundó la orden para promover las ideas de la Ilustración frente a la influencia de la Iglesia y del absolutismo. Reclutaba entre la élite instruida, en parte a través de logias masónicas, antes de que el elector Karl Theodor prohibiera las sociedades secretas no autorizadas.',
    claims: [
      'La orden de los Illuminati fue fundada en Ingolstadt (Baviera) el 1 de mayo de 1776 por Adam Weishaupt.',
      'El gobierno bávaro prohibió la orden en 1785.',
      'Los Illuminati habrían sobrevivido en secreto y orquestado la Revolución francesa.',
      'Los Illuminati controlarían hoy los gobiernos, las finanzas o la industria del entretenimiento.',
    ],
    counters: [
      'Los historiadores no han hallado pruebas de que la orden siguiera activa tras su supresión. La Revolución francesa tiene causas políticas, sociales y económicas ampliamente documentadas.',
      'Ninguna prueba creíble respalda esta afirmación. El relato está construido para ser irrefutable y se ha usado repetidamente para difundir mitos conspirativos antisemitas.',
    ],
  },
  'chemtrail-claims': {
    title: 'Afirmaciones sobre los chemtrails',
    subtitle: 'La creencia de que las estelas de los aviones son fumigaciones secretas',
    summary:
      'Las afirmaciones sobre los chemtrails sostienen que las estelas duraderas detrás de los aviones son agentes químicos o biológicos rociados a propósito. La ciencia de la atmósfera explica las estelas persistentes como estelas de condensación. Una encuesta de 2016 a 77 expertos no halló pruebas de un programa secreto de fumigación a gran escala.',
    background:
      'Los motores de los aviones emiten vapor de agua y partículas. En el aire frío y húmedo a la altitud de crucero, ese vapor se condensa y se congela en cristales de hielo, y forma estelas que pueden persistir y extenderse como nubes parecidas a los cirros.',
    claims: [
      'Los aviones producen estelas de condensación que pueden persistir y extenderse durante horas cuando la alta atmósfera está fría y húmeda.',
      'Las estelas persistentes serían sustancias químicas rociadas a propósito como parte de un programa secreto a gran escala.',
      'La geoingeniería solar, como inyectar aerosoles en la estratosfera, se ha propuesto en la literatura científica.',
    ],
    counters: [
      'En una encuesta revisada por pares, 76 de 77 químicos de la atmósfera y geoquímicos declararon no haber encontrado pruebas de un programa secreto de fumigación a gran escala; lo presentado como prueba se explicaba por otros factores.',
      'Se trata de propuestas y evaluaciones de investigación. No está documentado ningún despliegue secreto a gran escala.',
    ],
  },
  'jfk-related-conspiracy-narratives': {
    title: 'Relatos conspirativos sobre JFK',
    subtitle: 'Versiones enfrentadas del asesinato de 1963',
    summary:
      'El presidente John F. Kennedy fue asesinado en Dallas el 22 de noviembre de 1963. La Comisión Warren (1964) concluyó que Lee Harvey Oswald actuó solo. El comité especial de la Cámara sobre asesinatos (1979) concluyó que Kennedy probablemente fue asesinado como resultado de una conspiración, hallazgo basado en gran parte en pruebas acústicas que la Academia Nacional de Ciencias discutió en 1982.',
    background:
      'Oswald fue detenido el día del asesinato y Jack Ruby lo mató a tiros dos días después, así que no hubo juicio. Los huecos del expediente público y los archivos clasificados durante mucho tiempo alimentaron décadas de teorías alternativas.',
    claims: [
      'Kennedy fue asesinado a tiros en Dealey Plaza (Dallas) el 22 de noviembre de 1963.',
      'La Comisión Warren concluyó que Lee Harvey Oswald disparó y actuó solo.',
      'El HSCA concluyó en 1979 que Kennedy probablemente fue asesinado como resultado de una conspiración.',
      'Un segundo tirador habría disparado desde la «colina cubierta de hierba».',
      'La CIA, el crimen organizado u otros grupos habrían planeado el asesinato.',
    ],
    counters: [
      'El comité de acústica balística de la Academia Nacional de Ciencias concluyó en 1982 que las pruebas acústicas no mostraban un disparo desde la colina.',
      'Ninguna investigación oficial ha producido pruebas verificadas de esto. El HSCA halló que la CIA, el FBI y el Servicio Secreto no estaban implicados, aunque no pudo descartar la participación de miembros aislados de ciertos grupos.',
    ],
  },
  'tuskegee-syphilis-study': {
    title: 'Estudio de Tuskegee sobre la sífilis',
    subtitle: 'Cuarenta años de tratamiento denegado por el Servicio de Salud Pública de Estados Unidos',
    summary:
      'De 1932 a 1972, el Servicio de Salud Pública de Estados Unidos observó el curso de la sífilis no tratada en hombres negros del condado de Macon (Alabama). No se les dijo el diagnóstico ni se les trató, ni siquiera después de que la penicilina se convirtiera en el remedio habitual. El estudio terminó cuando la prensa lo reveló en 1972.',
    background:
      'Participaron unos 600 hombres: unos 400 con sífilis y unos 200 sin ella, como grupo de control. Se les dijo que los trataban de «mala sangre» y recibían comidas gratuitas, reconocimientos y un seguro de entierro. Los investigadores procuraron que no recibieran tratamiento en otro sitio.',
    claims: [
      'El Servicio de Salud Pública observó la sífilis no tratada en unos 600 hombres negros de Alabama de 1932 a 1972, sin su consentimiento informado.',
      'El tratamiento se siguió negando incluso después de que la penicilina se convirtiera, en los años cuarenta, en el remedio habitual de la sífilis.',
      'El escándalo llevó a nuevas reglas para la investigación con seres humanos, entre ellas la National Research Act de 1974 y el informe Belmont de 1979.',
      'A los hombres del estudio de Tuskegee se les habría infectado deliberadamente con sífilis.',
    ],
    counters: [
      'Los hombres ya tenían sífilis cuando fueron reclutados. La infección deliberada sí ocurrió en otros experimentos del Servicio de Salud Pública, en Guatemala, de 1946 a 1948.',
    ],
  },
  cointelpro: {
    title: 'COINTELPRO',
    subtitle: 'Los programas secretos del FBI contra grupos políticos dentro de Estados Unidos',
    summary:
      'De 1956 a 1971, el FBI llevó a cabo una serie de programas de contrainteligencia, conocidos como COINTELPRO, para vigilar, infiltrar, desacreditar y perturbar organizaciones políticas dentro de Estados Unidos. Los programas se hicieron públicos después de que activistas robaran expedientes de una oficina del FBI en 1971, y el comité Church los documentó en detalle.',
    background:
      'El primer programa, iniciado en 1956, se dirigió contra el Partido Comunista de Estados Unidos. Programas posteriores apuntaron al Socialist Workers Party, a grupos supremacistas blancos, a organizaciones nacionalistas negras y de derechos civiles, y a la Nueva Izquierda. Los métodos incluían cartas anónimas, noticias de prensa colocadas, informantes e intentos de provocar conflictos entre grupos.',
    claims: [
      'El FBI mantuvo de 1956 a 1971 programas de contrainteligencia para vigilar, infiltrar, desacreditar y perturbar organizaciones políticas dentro del país.',
      'Los programas se conocieron tras el robo de expedientes en la oficina del FBI de Media (Pensilvania) en marzo de 1971.',
      'En 1964, el FBI envió a Martin Luther King Jr. una carta anónima que él y sus asesores leyeron como una incitación al suicidio.',
      'COINTELPRO nunca habría terminado de verdad y continuaría igual hoy.',
    ],
    counters: [
      'Los programas terminaron oficialmente en 1971, y después se crearon normas de control y comisiones de inteligencia en el Congreso. Las afirmaciones sobre operaciones posteriores deben juzgarse por sus propias pruebas.',
    ],
  },
  'gulf-of-tonkin-incident': {
    title: 'Incidente del golfo de Tonkín',
    subtitle: 'El ataque que no ocurrió y la resolución que siguió',
    summary:
      'En agosto de 1964, Estados Unidos informó de dos ataques de lanchas norvietnamitas contra destructores estadounidenses en el golfo de Tonkín. El primero, el 2 de agosto, ocurrió. El segundo, informado el 4 de agosto, casi con seguridad no ocurrió. Aun así, el Congreso aprobó la resolución del golfo de Tonkín, que se convirtió en la base jurídica de la escalada de la guerra de Vietnam.',
    background:
      'El 2 de agosto de 1964, el destructor USS Maddox, en una patrulla de inteligencia, fue atacado por tres lanchas torpederas norvietnamitas. En la noche del 4 de agosto, el Maddox y el USS Turner Joy informaron de un segundo ataque con mal tiempo. El presidente Johnson ordenó ataques aéreos al día siguiente, y el 7 de agosto el Congreso aprobó la resolución con solo dos votos en contra en el Senado.',
    claims: [
      'El 2 de agosto de 1964, lanchas torpederas norvietnamitas atacaron al destructor USS Maddox en el golfo de Tonkín.',
      'El segundo ataque informado el 4 de agosto de 1964 no ocurrió.',
      'El Congreso aprobó la resolución del golfo de Tonkín el 7 de agosto de 1964; autorizaba al presidente a usar la fuerza armada en el Sudeste Asiático.',
      'Responsables estadounidenses habrían inventado a sabiendas el ataque del 4 de agosto como pretexto para la guerra.',
    ],
    counters: [
      'El estudio de la NSA muestra que la inteligencia de señales se manejó mal y se presentó de forma selectiva. Los historiadores no coinciden en si quienes decidían sabían entonces que no había habido ataque; los primeros informes de los destructores fueron confusos, no inventados.',
    ],
  },
  'operation-paperclip': {
    title: 'Operación Paperclip',
    subtitle: 'Cómo Estados Unidos reclutó a científicos alemanes después de 1945',
    summary:
      'Después de la Segunda Guerra Mundial, Estados Unidos trajo a más de 1.600 científicos, ingenieros y técnicos alemanes en un programa conocido como operación Paperclip. Entre ellos había antiguos miembros del partido nazi y de las SS. A menudo se minimizó su pasado para que pudieran trabajar e inmigrar.',
    background:
      'El programa lo administraba la Joint Intelligence Objectives Agency. Su objetivo era usar el saber alemán en cohetes, aviación, química y medicina, y sustraerlo a la Unión Soviética. El recluta más conocido fue Wernher von Braun, que había dirigido el programa del cohete V-2 y después dirigió el desarrollo del cohete lunar Saturno V.',
    claims: [
      'Estados Unidos reclutó después de 1945 a más de 1.600 científicos, ingenieros y técnicos alemanes, incluidos antiguos miembros del partido nazi y de las SS.',
      'Responsables minimizaron u omitieron el pasado nazi de algunos reclutas en sus expedientes para que pudieran inmigrar.',
      'El ingeniero de Paperclip Arthur Rudolph, jefe de proyecto del Saturno V, abandonó Estados Unidos en 1984 tras una investigación sobre su papel en la fábrica de trabajo forzado de Mittelwerk.',
      'Antiguos nazis habrían controlado en secreto la NASA y habrían seguido a través de ella un plan oculto.',
    ],
    counters: [
      'Ingenieros alemanes ocuparon puestos altos, sobre todo en el programa de cohetes de Huntsville, pero la NASA era una agencia civil bajo control político estadounidense. Ninguna prueba muestra un plan oculto.',
    ],
  },
  'roswell-incident': {
    title: 'Incidente de Roswell',
    subtitle: 'Un hallazgo de restos en 1947 y la historia de accidente extraterrestre en que se convirtió',
    summary:
      'En julio de 1947, las fuerzas aéreas del ejército de Estados Unidos en Roswell (Nuevo México) anunciaron que habían recuperado un «disco volante» y al día siguiente lo corrigieron a un globo meteorológico. Décadas después, el hecho se convirtió en la historia de accidente extraterrestre más conocida. Investigaciones de la Fuerza Aérea en los años noventa relacionaron los restos con el proyecto Mogul, un programa secreto de globos.',
    background:
      'Un ranchero encontró restos de lámina, goma, cinta y palos en un rancho al noroeste de Roswell. El 8 de julio de 1947, la oficina de prensa de Roswell Army Air Field publicó su comunicado del «disco volante»; al día siguiente, el comandante de la Eighth Air Force presentó el material como restos de un globo meteorológico. El proyecto Mogul usaba trenes de globos para escuchar pruebas nucleares soviéticas y entonces era secreto.',
    claims: [
      'El 8 de julio de 1947, Roswell Army Air Field anunció la recuperación de un «disco volante», y al día siguiente el comunicado fue sustituido por la explicación del globo meteorológico.',
      'Los restos procedían de un tren de globos secreto del proyecto Mogul.',
      'Una nave extraterrestre se habría estrellado cerca de Roswell y se habrían recuperado los cuerpos de su tripulación.',
      'Se destruyeron algunos expedientes administrativos de Roswell Army Air Field de ese periodo.',
      'Los expedientes destruidos probarían el encubrimiento de un accidente extraterrestre.',
    ],
    counters: [
      'Dos informes de la Fuerza Aérea y una revisión del Departamento de Defensa de 2024 no hallaron pruebas de una nave extraterrestre. Los relatos de cuerpos aparecieron décadas después y coinciden con pruebas de los años cincuenta con maniquíes antropomorfos y con accidentes sin relación.',
      'La General Accounting Office no pudo determinar quién destruyó los expedientes ni por qué. Su pérdida, por sí sola, no prueba qué ocurrió en 1947.',
    ],
  },
  'reichstag-fire': {
    title: 'Incendio del Reichstag',
    subtitle: '¿Quién incendió el parlamento alemán en 1933?',
    summary:
      'En la noche del 27 de febrero de 1933 ardió el edificio del Reichstag en Berlín. El comunista de consejos neerlandés Marinus van der Lubbe fue detenido en el lugar. El nuevo gobierno nazi usó el incendio para suspender derechos fundamentales al día siguiente. Si van der Lubbe actuó solo o si los nazis estuvieron implicados sigue siendo objeto de debate entre los historiadores.',
    background:
      'Adolf Hitler había sido nombrado canciller cuatro semanas antes. El 28 de febrero, el presidente Hindenburg firmó el decreto del incendio del Reichstag, que suspendía la libertad de prensa, de reunión y de expresión y permitía detenciones sin juicio. En las semanas siguientes fueron internados miles de comunistas y otros opositores, poco antes de las elecciones del 5 de marzo de 1933.',
    claims: [
      'El edificio del Reichstag ardió en la noche del 27 de febrero de 1933 y Marinus van der Lubbe fue detenido en su interior.',
      'Al día siguiente, el decreto del incendio del Reichstag suspendió derechos fundamentales; se usó para perseguir a comunistas y a otros opositores.',
      'El incendio formaba parte de un levantamiento comunista planeado, como afirmó el gobierno nazi.',
      'Van der Lubbe provocó el incendio solo.',
      'Los nazis habrían provocado ellos mismos el incendio para hacerse con el poder.',
    ],
    counters: [
      'No se hallaron pruebas de un levantamiento planeado, y el tribunal de Leipzig absolvió en diciembre de 1933 a los cuatro coacusados comunistas.',
      'Algunos historiadores sostienen que la extensión del incendio y las circunstancias apuntan a cómplices; la cuestión no está zanjada.',
      'Ningún documento directo prueba que los nazis provocaran el incendio. Historiadores como Fritz Tobias y Hans Mommsen defendieron la tesis de un autor único; el debate continúa.',
    ],
  },
};

export const events = {
  'illuminati-founded': ['Fundación de la orden de los Illuminati', 'Adam Weishaupt funda la orden en Ingolstadt.'],
  'illuminati-ban': ['Edictos bávaros reprimen las sociedades secretas', 'El elector Karl Theodor prohíbe las sociedades no autorizadas; el edicto de 1785 nombra a los Illuminati.'],
  'conspiracy-books-1797': ['Barruel y Robison publican libros sobre una conspiración de los Illuminati', 'Ambos autores atribuyen la Revolución francesa a una conspiración secreta.'],
  'mkultra-approved': ['Aprobación de MKUltra', 'El director de la CIA Allen Dulles aprueba el programa.'],
  'olson-death': ['Muerte de Frank Olson', 'Olson muere en Nueva York días después de recibir LSD a escondidas en un experimento de la CIA.'],
  'groom-lake-selected': ['Groom Lake elegido como centro de pruebas del U-2', 'La CIA y la Fuerza Aérea establecen el centro remoto más tarde conocido como Área 51.'],
  'u2-oxcart': ['Pruebas del U-2 y de OXCART en Groom Lake', 'Desarrollo y pruebas de aviones de reconocimiento a gran altitud.'],
  'northwoods-memo': ['Entrega del memorando Northwoods', 'Los jefes del Estado Mayor envían propuestas de pretexto al secretario de Defensa.'],
  'jfk-assassination': ['Asesinato de John F. Kennedy', 'El presidente Kennedy es asesinado a tiros en Dallas.'],
  'warren-report': ['Entrega del informe de la Comisión Warren', 'La comisión concluye que Oswald actuó solo.'],
  apollo11: ['Misión Apolo 11', 'Lanzamiento desde el Centro Espacial Kennedy, alunizaje el 20 de julio y regreso el 24 de julio.'],
  'watergate-breakin': ['Allanamiento del Watergate', 'Detienen a cinco hombres dentro de las oficinas del Comité Nacional Demócrata.'],
  'mkultra-files-destroyed': ['Destrucción de los expedientes de MKUltra', 'La mayor parte de los expedientes del programa se destruye por orden de Richard Helms.'],
  'watergate-hearings': ['Audiencias del Senado sobre el Watergate', 'Comienzan las audiencias televisadas del comité especial del Senado.'],
  'us-v-nixon': ['United States v. Nixon', 'El Tribunal Supremo ordena la entrega de las cintas de la Casa Blanca.'],
  'nixon-resigns': ['Dimisión de Nixon', 'Richard Nixon se convierte en el primer presidente de Estados Unidos que dimite.'],
  'church-committee': ['Investigaciones del comité Church', 'El Senado investiga los abusos de los servicios de inteligencia de Estados Unidos.'],
  'kaysing-book': ['Publicación de «We Never Went to the Moon»', 'Bill Kaysing publica uno de los primeros libros sobre el fraude lunar.'],
  'mkultra-hearing': ['Audiencia del Senado sobre MKUltra', 'El director de la CIA Stansfield Turner declara sobre los expedientes de MKUltra que se conservan.'],
  'hsca-report': ['Informe final del HSCA', 'El comité concluye una «conspiración probable» en el asesinato de Kennedy.'],
  'nas-acoustics': ['Informe de acústica de la Academia Nacional de Ciencias', 'Científicos rechazan las pruebas acústicas usadas por el HSCA.'],
  'lazar-claims': ['Bob Lazar formula afirmaciones sobre el Área 51', 'En una entrevista de televisión en Las Vegas, Lazar afirma haber trabajado en naves extraterrestres. El contenido de esas afirmaciones no está verificado.'],
  'jfk-records-act': ['Firma de la JFK Records Act', 'La ley obliga a revisar y publicar los expedientes del asesinato.'],
  'northwoods-declassified': ['Desclasificación del memorando Northwoods', 'Publicado por la Assassination Records Review Board.'],
  'chemtrail-spread': ['Difusión de las afirmaciones sobre los chemtrails', 'Las afirmaciones circulan en la radio de tertulia y en los primeros foros de internet.'],
  'epa-factsheet': ['La EPA publica una ficha sobre las estelas de condensación', 'Agencias federales explican cómo se forman y persisten las estelas.'],
  'felt-identified': ['Identificación de «Deep Throat»', 'Se revela que Mark Felt era la fuente del Washington Post.'],
  'lro-images': ['Imágenes orbitales de los lugares de alunizaje del Apolo', 'El Lunar Reconnaissance Orbiter fotografía el material de los alunizajes del Apolo.'],
  'area51-acknowledged': ['Una historia de la CIA reconoce el Área 51', 'Se publica una historia desclasificada de la CIA tras una solicitud FOIA.'],
  'shearer-study': ['Publicación de una encuesta de expertos sobre los chemtrails', '76 de 77 científicos encuestados no informan de pruebas de una fumigación secreta.'],
  'aaro-report': ['Informe histórico de la AARO', 'El Departamento de Defensa no halla pruebas de tecnología extraterrestre en programas del gobierno.'],
  'tuskegee-begins': ['Comienza el estudio de Tuskegee sobre la sífilis', 'El Servicio de Salud Pública empieza a observar la sífilis no tratada en hombres negros del condado de Macon.'],
  'tuskegee-exposed': ['La prensa revela el estudio de Tuskegee', 'Un reportaje de Associated Press de Jean Heller hace público el estudio; termina más tarde ese año.'],
  'belmont-report': ['Publicación del informe Belmont', 'Una comisión nacional enuncia principios éticos para la investigación con seres humanos.'],
  'tuskegee-apology': ['Disculpa presidencial por el estudio de Tuskegee', 'El presidente Bill Clinton pide disculpas a los supervivientes y a sus familias.'],
  'cointelpro-begins': ['Comienza el primer programa COINTELPRO', 'El FBI inicia un programa de contrainteligencia contra el Partido Comunista de Estados Unidos.'],
  'media-burglary': ['Allanamiento de la oficina del FBI en Media', 'Activistas roban expedientes de la oficina local del FBI y los envían a periódicos.'],
  'cointelpro-ends': ['Fin oficial de COINTELPRO', 'J. Edgar Hoover ordena el fin de los programas de contrainteligencia.'],
  'tonkin-aug2': ['Ataque contra el USS Maddox', 'Tres lanchas torpederas norvietnamitas atacan al destructor USS Maddox.'],
  'tonkin-aug4': ['Segundo ataque informado en el golfo de Tonkín', 'Dos destructores estadounidenses informan de un ataque con mal tiempo; un análisis posterior muestra que no ocurrió.'],
  'tonkin-resolution': ['Aprobación de la resolución del golfo de Tonkín', 'El Congreso autoriza al presidente a usar la fuerza armada en el Sudeste Asiático.'],
  'hanyok-released': ['La NSA publica el estudio del golfo de Tonkín', 'La NSA desclasifica el estudio de Robert J. Hanyok, que concluye que el ataque del 4 de agosto no ocurrió.'],
  'paperclip-begins': ['Llegan a Estados Unidos los primeros científicos alemanes', 'Wernher von Braun y otros ingenieros de cohetes llegan a Estados Unidos.'],
  'saturn-v-first-flight': ['Primer vuelo del Saturno V', 'La misión Apolo 4, sin tripulación, lanza el cohete lunar desarrollado bajo von Braun.'],
  'rudolph-leaves': ['Arthur Rudolph abandona Estados Unidos', 'El antiguo responsable del Saturno V se marcha tras una investigación sobre su papel en la guerra.'],
  'roswell-press-release': ['Comunicado de Roswell sobre un «disco volante»', 'Roswell Army Air Field anuncia un «disco volante» recuperado; al día siguiente sigue la explicación del globo meteorológico.'],
  'roswell-book': ['Publicación de «The Roswell Incident»', 'Charles Berlitz y William L. Moore popularizan el relato del accidente extraterrestre.'],
  'roswell-reports': ['Informes de la Fuerza Aérea sobre Roswell', 'La Fuerza Aérea atribuye los restos al proyecto Mogul y los relatos de cuerpos a pruebas posteriores con maniquíes.'],
  'reichstag-fire': ['Incendio del Reichstag', 'Arde el edificio del Reichstag; Marinus van der Lubbe es detenido en su interior.'],
  'reichstag-decree': ['Decreto del incendio del Reichstag', 'El presidente Hindenburg suspende derechos fundamentales por decreto de urgencia.'],
  'reichstag-trial': ['Juicio del incendio del Reichstag en Leipzig', 'Van der Lubbe es condenado a muerte; los cuatro coacusados comunistas son absueltos.'],
};
