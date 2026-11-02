package be.pxlstudio.jarvis

import android.Manifest
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Bundle
import android.speech.RecognizerIntent
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.outlined.AddComment
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.VolumeUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object Jc {
    val Bg = Color(0xFF070B12)
    val Panel = Color(0xFF0E1622)
    val Panel2 = Color(0xFF142131)
    val Accent = Color(0xFF35D6FF)
    val Accent2 = Color(0xFF7C5CFF)
    val Text = Color(0xFFE7F3FF)
    val Muted = Color(0xFF8AA0B6)
    val UserBubble = Color(0xFF123247)
}

private val jarvisColors = darkColorScheme(
    primary = Jc.Accent, onPrimary = Color(0xFF00121A), secondary = Jc.Accent2,
    background = Jc.Bg, surface = Jc.Panel, onSurface = Jc.Text, onBackground = Jc.Text,
    surfaceVariant = Jc.Panel2, onSurfaceVariant = Jc.Muted, outline = Color(0xFF26384C),
)

class MainActivity : ComponentActivity() {
    private val vm: JarvisViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { MaterialTheme(colorScheme = jarvisColors) { JarvisApp(vm) } }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JarvisApp(vm: JarvisViewModel) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var showSettings by remember { mutableStateOf(false) }
    var showImage by remember { mutableStateOf(false) }

    val notifPerm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
    LaunchedEffect(vm.toast) {
        vm.toast?.let { Toast.makeText(context, it, Toast.LENGTH_SHORT).show(); vm.toast = null }
    }

    Scaffold(
        containerColor = Jc.Bg,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Jc.Bg),
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Core(28.dp, active = vm.generating || vm.imageJob != null)
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text("JARVIS", fontWeight = FontWeight.Bold, letterSpacing = 4.sp, color = Jc.Text, fontSize = 18.sp)
                            Text(
                                if (vm.phase == Phase.Ready) "${Models.displayName(vm.brainId)} · hors ligne · ${vm.backendName}" else "assistant local",
                                color = Jc.Muted, fontSize = 11.sp,
                            )
                        }
                    }
                },
                actions = {
                    if (vm.phase == Phase.Ready) {
                        IconButton(onClick = { showImage = true }) { Icon(Icons.Outlined.Image, "Image", tint = Jc.Accent) }
                        IconButton(onClick = { vm.newConversation() }) { Icon(Icons.Outlined.AddComment, "Nouvelle conversation", tint = Jc.Accent) }
                    }
                    IconButton(onClick = { showSettings = true }) { Icon(Icons.Outlined.Settings, "Réglages", tint = Jc.Accent) }
                },
            )
        },
    ) { pad ->
        Box(Modifier.padding(pad).fillMaxSize().imePadding()) {
            when (val p = vm.phase) {
                Phase.NeedBrain -> SetupScreen(vm)
                is Phase.Loading -> Centered { Core(90.dp, true); Spacer(Modifier.height(20.dp)); Text(p.text, color = Jc.Muted) }
                is Phase.Error -> Centered {
                    Text(p.text, color = Color(0xFFFF8A80), textAlign = TextAlign.Center)
                    Spacer(Modifier.height(16.dp))
                    Button(onClick = { vm.loadBrain() }) { Text("Réessayer") }
                    TextButton(onClick = { vm.updateSettings(gpu = false); vm.loadBrain() }) { Text("Réessayer sans accélération GPU") }
                    TextButton(onClick = { showSettings = true }) { Text("Changer de cerveau") }
                }
                Phase.Ready -> ChatScreen(vm)
            }
        }
    }

    if (showSettings) SettingsSheet(vm) { showSettings = false }
    if (showImage) ImageDialog(vm) { showImage = false }
}

@Composable
private fun Centered(content: @Composable ColumnScope.() -> Unit) =
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        content = content,
    )

/** Le « réacteur » animé de Jarvis. */
@Composable
fun Core(size: androidx.compose.ui.unit.Dp, active: Boolean) {
    val t = rememberInfiniteTransition(label = "core")
    val pulse by t.animateFloat(0.6f, 1f, infiniteRepeatable(tween(if (active) 600 else 2200), RepeatMode.Reverse), label = "p")
    val rot by t.animateFloat(0f, 360f, infiniteRepeatable(tween(if (active) 1800 else 9000)), label = "r")
    Canvas(Modifier.size(size)) {
        val r = this.size.minDimension / 2
        drawCircle(Brush.radialGradient(listOf(Jc.Accent.copy(alpha = 0.35f * pulse), Color.Transparent)), r)
        drawCircle(Jc.Accent, r * 0.92f, style = Stroke(r * 0.08f))
        drawArc(Jc.Accent.copy(alpha = 0.7f), rot, 80f, false, style = Stroke(r * 0.16f),
            topLeft = Offset(r * 0.32f, r * 0.32f), size = androidx.compose.ui.geometry.Size(r * 1.36f, r * 1.36f))
        drawArc(Jc.Accent2.copy(alpha = 0.7f), rot + 180f, 80f, false, style = Stroke(r * 0.16f),
            topLeft = Offset(r * 0.32f, r * 0.32f), size = androidx.compose.ui.geometry.Size(r * 1.36f, r * 1.36f))
        drawCircle(Color(0xFFBFF3FF).copy(alpha = pulse), r * 0.3f)
    }
}

// ------------------------------------------------------------------ Installation

@Composable
private fun SetupScreen(vm: JarvisViewModel) {
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let { vm.importBrain(it) } }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { Core(110.dp, vm.downloads.isNotEmpty()) }
        Spacer(Modifier.height(18.dp))
        Text("Installe le cerveau de Jarvis", color = Jc.Text, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Un seul téléchargement (Wi‑Fi conseillé). Ensuite Jarvis fonctionne entièrement sur ton téléphone, " +
                "même en mode avion. Aucun compte, aucun abonnement, rien n'est envoyé ailleurs.",
            color = Jc.Muted,
        )
        Spacer(Modifier.height(18.dp))
        Models.brains.forEach { ModelCard(vm, it) ; Spacer(Modifier.height(12.dp)) }
        TextButton(onClick = { picker.launch(arrayOf("*/*")) }) { Text("J'ai déjà un fichier .litertlm : l'importer") }
    }
}

@Composable
fun ModelCard(vm: JarvisViewModel, m: ModelFile) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val dl = vm.downloads[m.kind]?.takeIf { it.modelId == m.id }
    val ready = Models.isReady(ctx, m.id) && dl == null
    val selected = (m.kind == Kind.BRAIN && vm.brainId == m.id) || (m.kind == Kind.IMAGE && vm.imageId == m.id)
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Jc.Panel)
            .border(1.dp, if (m.recommended || selected) Jc.Accent.copy(alpha = 0.6f) else Color(0xFF1E2C3D), RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(m.name, color = Jc.Text, fontWeight = FontWeight.Bold, fontSize = 17.sp, modifier = Modifier.weight(1f))
            if (m.recommended) Text("RECOMMANDÉ", color = Jc.Accent, fontSize = 10.sp, letterSpacing = 1.sp)
        }
        Text(m.tagline, color = Jc.Muted, fontSize = 13.sp)
        Text("%.1f Go".format(m.sizeBytes / 1e9), color = Jc.Muted, fontSize = 12.sp)
        Spacer(Modifier.height(10.dp))
        when {
            dl != null -> {
                val frac = if (dl.total > 0) dl.done.toFloat() / dl.total else 0f
                LinearProgressIndicator(progress = { frac }, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${(frac * 100).toInt()} % · ${dl.status}", color = Jc.Muted, fontSize = 12.sp, modifier = Modifier.weight(1f))
                    TextButton(onClick = { vm.cancelDownload(m.kind) }) { Text("Annuler") }
                }
                if (dl.status.startsWith("Échec")) Button(onClick = { vm.download(m) }) { Text("Réessayer") }
            }
            ready -> Row {
                if (selected) Text("✓ Utilisé", color = Jc.Accent, modifier = Modifier.align(Alignment.CenterVertically).weight(1f))
                else {
                    Button(onClick = {
                        if (m.kind == Kind.BRAIN) vm.useBrain(m.id) else vm.useImageModel(m.id)
                    }) { Text("Utiliser") }
                    Spacer(Modifier.weight(1f))
                }
                TextButton(onClick = { vm.deleteModel(m.id) }) { Text("Supprimer", color = Color(0xFFFF8A80)) }
            }
            else -> Button(onClick = { vm.download(m) }, enabled = vm.downloads[m.kind] == null) { Text("Télécharger") }
        }
    }
}

// ------------------------------------------------------------------ Chat

private val suggestions = listOf(
    "Rédige un mail de relance pour un devis non signé",
    "Crée-moi une landing page HTML pour un food truck",
    "Mets une alarme à 6h30",
    "Explique-moi la TVA intracommunautaire simplement",
)

@Composable
private fun ChatScreen(vm: JarvisViewModel) {
    var input by remember { mutableStateOf("") }
    val list = rememberLazyListState()
    val speech = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val said = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (!said.isNullOrBlank()) vm.send(said)
    }
    val count = vm.messages.size
    val lastLen = vm.messages.lastOrNull()?.text?.length ?: 0
    LaunchedEffect(count, lastLen / 80, vm.imageJob) {
        if (count > 0) list.animateScrollToItem(count - 1 + (if (vm.imageJob != null) 1 else 0))
    }

    Column(Modifier.fillMaxSize()) {
        if (vm.messages.isEmpty()) {
            Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Core(80.dp, false)
                Spacer(Modifier.height(14.dp))
                Text(
                    if (vm.userName.isBlank()) "À ton service." else "À ton service, ${vm.userName}.",
                    color = Jc.Text, fontSize = 20.sp, fontWeight = FontWeight.SemiBold,
                )
                Text("Demande-moi n'importe quoi. Tout reste sur ce téléphone.", color = Jc.Muted, textAlign = TextAlign.Center)
                Spacer(Modifier.height(18.dp))
                suggestions.forEach {
                    Text(it, color = Jc.Text, fontSize = 14.sp, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                        .clip(RoundedCornerShape(12.dp)).background(Jc.Panel).clickable { vm.send(it) }.padding(12.dp))
                }
            }
        } else {
            LazyColumn(state = list, modifier = Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(12.dp)) {
                itemsIndexed(vm.messages) { i, m ->
                    Bubble(vm, m, typing = vm.generating && i == vm.messages.lastIndex && !m.fromUser)
                }
                vm.imageJob?.let { job -> item { ImageProgress(vm, job) } }
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(10.dp).clip(RoundedCornerShape(26.dp)).background(Jc.Panel)
                .border(1.dp, Color(0xFF1E2C3D), RoundedCornerShape(26.dp)).padding(horizontal = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = {
                vm.stopSpeaking()
                val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "fr-FR")
                    .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                    .putExtra(RecognizerIntent.EXTRA_PROMPT, "Je t'écoute…")
                runCatching { speech.launch(i) }.onFailure { vm.toast = "Reconnaissance vocale indisponible" }
            }, enabled = !vm.generating) { Icon(Icons.Filled.Mic, "Parler", tint = Jc.Accent) }
            TextField(
                value = input, onValueChange = { input = it },
                placeholder = { Text("Demande à Jarvis…", color = Jc.Muted) },
                modifier = Modifier.weight(1f), maxLines = 6,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent,
                ),
            )
            if (vm.generating) {
                IconButton(onClick = { vm.stop() }) { Icon(Icons.Filled.Stop, "Stop", tint = Color(0xFFFF8A80)) }
            } else {
                IconButton(onClick = { vm.send(input); input = "" }, enabled = input.isNotBlank()) {
                    Icon(Icons.AutoMirrored.Filled.Send, "Envoyer", tint = if (input.isNotBlank()) Jc.Accent else Jc.Muted)
                }
            }
        }
    }
}

@Composable
private fun Bubble(vm: JarvisViewModel, m: ChatMsg, typing: Boolean) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = if (m.fromUser) Arrangement.End else Arrangement.Start) {
        Column(
            Modifier.widthIn(max = 640.dp).fillMaxWidth(if (m.fromUser) 0.85f else 1f)
                .clip(RoundedCornerShape(18.dp))
                .background(if (m.fromUser) Jc.UserBubble else Jc.Panel)
                .padding(12.dp)
        ) {
            if (m.imagePath != null) {
                val bmp = remember(m.imagePath) { runCatching { BitmapFactory.decodeFile(m.imagePath) }.getOrNull() }
                if (bmp != null) {
                    Image(bmp.asImageBitmap(), "Image générée", contentScale = ContentScale.FillWidth,
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)))
                    TextButton(onClick = { vm.exportImage(m.imagePath) }) { Text("Enregistrer dans la galerie") }
                } else Text("Image introuvable", color = Jc.Muted)
            } else if (m.fromUser) {
                Text(m.text, color = Jc.Text, fontSize = 16.sp)
            } else if (m.text.isEmpty() && typing) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Core(20.dp, true); Spacer(Modifier.width(8.dp)); Text("Jarvis réfléchit…", color = Jc.Muted)
                }
            } else {
                MarkdownText(m.text, Jc.Text)
                if (!typing && m.text.isNotBlank()) {
                    Row {
                        IconButton(onClick = { vm.speakText(m.text) }, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Outlined.VolumeUp, "Lire", tint = Jc.Muted, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ImageProgress(vm: JarvisViewModel, job: ImageJob) {
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp).clip(RoundedCornerShape(18.dp)).background(Jc.Panel).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Core(22.dp, true); Spacer(Modifier.width(8.dp))
            Text("Création de l'image…", color = Jc.Text, modifier = Modifier.weight(1f))
            TextButton(onClick = { vm.cancelImage() }) { Text("Annuler") }
        }
        val frac = if (job.steps > 0) job.step.toFloat() / job.steps else 0f
        if (job.step == 0) LinearProgressIndicator(Modifier.fillMaxWidth())
        else LinearProgressIndicator(progress = { frac }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(6.dp))
        Text(job.prompt, color = Jc.Muted, fontSize = 12.sp, maxLines = 3)
    }
}

// ------------------------------------------------------------------ Image directe

@Composable
private fun ImageDialog(vm: JarvisViewModel, onClose: () -> Unit) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    var prompt by remember { mutableStateOf("") }
    var format by remember { mutableStateOf("carre") }
    val ready = vm.imageLibAvailable && Models.isReady(ctx, vm.imageId)
    AlertDialog(
        onDismissRequest = onClose,
        containerColor = Jc.Panel,
        title = { Text("Créer une image", color = Jc.Text) },
        text = {
            Column {
                if (!vm.imageLibAvailable) Text("Le moteur d'images n'est pas inclus dans cette version de l'appli.", color = Color(0xFFFF8A80))
                else if (!ready) Text("Télécharge d'abord un modèle d'images dans les Réglages.", color = Jc.Muted)
                else {
                    Text("Décris l'image (en anglais = meilleur résultat). Astuce : demande aussi à Jarvis dans le chat, il écrit la description pour toi.",
                        color = Jc.Muted, fontSize = 13.sp)
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(prompt, { prompt = it }, minLines = 3, modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("ex: cinematic photo of a neon city at night, rain, 35mm") })
                    Spacer(Modifier.height(8.dp))
                    Row {
                        listOf("carre" to "Carré", "portrait" to "Portrait", "paysage" to "Paysage").forEach { (k, l) ->
                            FilterChip(selected = format == k, onClick = { format = k }, label = { Text(l) }, modifier = Modifier.padding(end = 6.dp))
                        }
                    }
                }
            }
        },
        confirmButton = {
            if (ready) Button(onClick = { vm.generateImageDirect(prompt, format); onClose() }, enabled = prompt.isNotBlank()) { Text("Créer") }
        },
        dismissButton = { TextButton(onClick = onClose) { Text("Fermer") } },
    )
}

// ------------------------------------------------------------------ Réglages

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsSheet(vm: JarvisViewModel, onClose: () -> Unit) {
    var name by remember { mutableStateOf(vm.userName) }
    var mem by remember { mutableStateOf(vm.memory) }
    ModalBottomSheet(onDismissRequest = { vm.updateSettings(name = name, mem = mem); onClose() }, containerColor = Jc.Bg) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 40.dp)) {
            Text("Réglages", color = Jc.Text, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(14.dp))

            OutlinedTextField(name, { name = it }, label = { Text("Ton prénom") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(mem, { mem = it }, label = { Text("Ce que Jarvis sait de toi (mémoire)") }, minLines = 4,
                modifier = Modifier.fillMaxWidth(),
                supportingText = { Text("Jarvis complète cette mémoire tout seul quand tu lui dis quelque chose d'important.") })
            Spacer(Modifier.height(6.dp))

            Toggle("Lire les réponses à voix haute", vm.speak) { vm.updateSettings(name = name, mem = mem, speakV = it) }
            Toggle("Réflexion approfondie (plus lent, plus malin)", vm.thinkingOn) { vm.updateSettings(name = name, mem = mem, think = it) }
            Toggle("Outils (alarme, agenda, SMS, calcul, fichiers…)", vm.toolsOn) { vm.updateSettings(name = name, mem = mem, tools = it) }
            Toggle("Outils Internet (recherche web, Wikipédia, pages)", vm.internetOn, enabled = vm.toolsOn) {
                vm.updateSettings(name = name, mem = mem, net = it)
            }
            Toggle("Accélération GPU", vm.useGpu) { vm.updateSettings(name = name, mem = mem, gpu = it) }

            Spacer(Modifier.height(18.dp))
            Text("Cerveau", color = Jc.Text, fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Spacer(Modifier.height(8.dp))
            Models.brains.forEach { ModelCard(vm, it); Spacer(Modifier.height(10.dp)) }

            Spacer(Modifier.height(10.dp))
            Text("Images", color = Jc.Text, fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Text(
                if (vm.imageLibAvailable) "Génération 100 % locale. Contenu adulte autorisé entre adultes fictifs ; jamais de mineurs ni de vraies personnes."
                else "Le moteur d'images n'est pas inclus dans cette version de l'appli.",
                color = Jc.Muted, fontSize = 13.sp,
            )
            Spacer(Modifier.height(8.dp))
            if (vm.imageLibAvailable) Models.images.forEach { ModelCard(vm, it); Spacer(Modifier.height(10.dp)) }

            Spacer(Modifier.height(14.dp))
            Text("Connexions externes (Odoo, Outlook…) : aucune. Jarvis ne se connecte à aucun compte.",
                color = Jc.Muted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun Toggle(label: String, value: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = if (enabled) Jc.Text else Jc.Muted, modifier = Modifier.weight(1f))
        Switch(value, onChange, enabled = enabled)
    }
}
