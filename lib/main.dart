import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'firebase_options.dart';

// Identifica esse app/sessão. Gerado uma vez por execução.
final String meuId =
    'app_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(99999)}';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  runApp(const MeuApp());
}

class MeuApp extends StatelessWidget {
  const MeuApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Controle ESP32',
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.teal),
      home: const TelaControle(),
    );
  }
}

// ---------- Detecta se o ESP está online (recebendo sinal de vida) ----------
class StatusOnlineBuilder extends StatefulWidget {
  final String dispositivo;
  final Widget Function(BuildContext context, bool online) builder;

  const StatusOnlineBuilder({
    super.key,
    required this.dispositivo,
    required this.builder,
  });

  @override
  State<StatusOnlineBuilder> createState() => _StatusOnlineBuilderState();
}

class _StatusOnlineBuilderState extends State<StatusOnlineBuilder> {
  DateTime? ultimoRecebimento;
  late final DatabaseReference refSinal;
  StreamSubscription<DatabaseEvent>? inscricao;
  Timer? timer;

  static const limiteOffline = Duration(seconds: 30);

  @override
  void initState() {
    super.initState();
    refSinal = FirebaseDatabase.instance
        .ref('dispositivos/${widget.dispositivo}/sinal');

    inscricao = refSinal.onValue.listen((evento) {
      if (evento.snapshot.value != null && mounted) {
        setState(() => ultimoRecebimento = DateTime.now());
      }
    });

    // Reavalia periodicamente, pra detectar quando o sinal parou de chegar
    timer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    inscricao?.cancel();
    timer?.cancel();
    super.dispose();
  }

  bool get online {
    if (ultimoRecebimento == null) return false;
    return DateTime.now().difference(ultimoRecebimento!) < limiteOffline;
  }

  @override
  Widget build(BuildContext context) {
    return widget.builder(context, online);
  }
}

// ---------- Tela inicial: lista de ESPs ----------
class TelaControle extends StatelessWidget {
  const TelaControle({super.key});

  // Adicione aqui o id de cada ESP32 que você tiver
  final List<String> dispositivos = const ['esp32_1', 'esp32_2'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Meus ESP32')),
      body: ListView.separated(
        itemCount: dispositivos.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, indice) {
          final dispositivo = dispositivos[indice];
          return StatusOnlineBuilder(
            dispositivo: dispositivo,
            builder: (context, online) {
              return ListTile(
                leading: Icon(
                  Icons.circle,
                  size: 14,
                  color: online ? Colors.green : Colors.grey,
                ),
                title: Text(dispositivo),
                subtitle: Text(online ? 'Disponível' : 'Indisponível'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => TelaDispositivo(dispositivo: dispositivo),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}

// ---------- Tela de controle de um ESP específico ----------
class TelaDispositivo extends StatefulWidget {
  final String dispositivo;
  const TelaDispositivo({super.key, required this.dispositivo});

  @override
  State<TelaDispositivo> createState() => _TelaDispositivoState();
}

class _TelaDispositivoState extends State<TelaDispositivo> {
  double r = 255;
  double g = 255;
  double b = 255;

  late final DatabaseReference refBloqueio = FirebaseDatabase.instance
      .ref('dispositivos/${widget.dispositivo}/bloqueio');
  late final DatabaseReference refCor =
  FirebaseDatabase.instance.ref('dispositivos/${widget.dispositivo}/cor');
  late final DatabaseReference refModo = FirebaseDatabase.instance
      .ref('dispositivos/${widget.dispositivo}/modo');

  String paraHex() {
    int ri = r.round();
    int gi = g.round();
    int bi = b.round();
    return ri.toRadixString(16).padLeft(2, '0') +
        gi.toRadixString(16).padLeft(2, '0') +
        bi.toRadixString(16).padLeft(2, '0');
  }

  void enviarCor() {
    refCor.set(paraHex());
  }

  void definirModo(String modo) {
    refModo.set(modo);
  }

  Future<void> pegarControle() async {
    await refBloqueio.set({'ocupado': true, 'usuario': meuId});
    refBloqueio.onDisconnect().set({'ocupado': false, 'usuario': ''});
  }

  Future<void> liberarControle() async {
    await refBloqueio.set({'ocupado': false, 'usuario': ''});
  }

  @override
  Widget build(BuildContext context) {
    final corAtual = Color.fromARGB(255, r.round(), g.round(), b.round());

    return Scaffold(
      appBar: AppBar(title: Text(widget.dispositivo)),
      body: StatusOnlineBuilder(
        dispositivo: widget.dispositivo,
        builder: (context, online) {
          if (!online) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Indisponível — o ESP parece estar desligado ou sem internet.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16),
                ),
              ),
            );
          }

          return Padding(
            padding: const EdgeInsets.all(16),
            child: StreamBuilder<DatabaseEvent>(
              stream: refBloqueio.onValue,
              builder: (context, snapshotBloqueio) {
                bool ocupado = false;
                String usuario = '';

                final valorBloqueio = snapshotBloqueio.data?.snapshot.value;
                if (valorBloqueio != null && valorBloqueio is Map) {
                  ocupado = valorBloqueio['ocupado'] == true;
                  usuario = (valorBloqueio['usuario'] ?? '').toString();
                }

                final souEu = usuario == meuId;
                final bloqueadoPorOutro = ocupado && !souEu;

                return StreamBuilder<DatabaseEvent>(
                  stream: refModo.onValue,
                  builder: (context, snapshotModo) {
                    final arcoIrisAtivo =
                        snapshotModo.data?.snapshot.value == 'arco_iris';
                    final controlesDesabilitados =
                        bloqueadoPorOutro || arcoIrisAtivo;

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            if (bloqueadoPorOutro)
                              const Chip(label: Text('Em uso'))
                            else if (souEu)
                              const Chip(
                                label: Text('Você está no controle'),
                                backgroundColor: Colors.tealAccent,
                              )
                            else
                              const Chip(label: Text('Disponível')),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Container(
                          height: 56,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color:
                            arcoIrisAtivo ? Colors.grey.shade300 : corAtual,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.black12),
                          ),
                          child: arcoIrisAtivo
                              ? const Text('Modo arco-íris ativo')
                              : null,
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Expanded(child: Text('Modo arco-íris')),
                            Switch(
                              value: arcoIrisAtivo,
                              onChanged: bloqueadoPorOutro
                                  ? null
                                  : (valor) => definirModo(
                                  valor ? 'arco_iris' : 'manual'),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            const SizedBox(width: 16, child: Text('R')),
                            Expanded(
                              child: Slider(
                                value: r,
                                min: 0,
                                max: 255,
                                activeColor: Colors.red,
                                onChanged: controlesDesabilitados
                                    ? null
                                    : (valor) => setState(() => r = valor),
                              ),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            const SizedBox(width: 16, child: Text('G')),
                            Expanded(
                              child: Slider(
                                value: g,
                                min: 0,
                                max: 255,
                                activeColor: Colors.green,
                                onChanged: controlesDesabilitados
                                    ? null
                                    : (valor) => setState(() => g = valor),
                              ),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            const SizedBox(width: 16, child: Text('B')),
                            Expanded(
                              child: Slider(
                                value: b,
                                min: 0,
                                max: 255,
                                activeColor: Colors.blue,
                                onChanged: controlesDesabilitados
                                    ? null
                                    : (valor) => setState(() => b = valor),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        if (bloqueadoPorOutro)
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: null,
                              child: const Text('Em uso por outra pessoa'),
                            ),
                          )
                        else if (souEu)
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: arcoIrisAtivo ? null : enviarCor,
                                  child: const Text('Aplicar cor'),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: liberarControle,
                                  child: const Text('Liberar controle'),
                                ),
                              ),
                            ],
                          )
                        else
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: pegarControle,
                              child: const Text('Pegar controle'),
                            ),
                          ),
                      ],
                    );
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}