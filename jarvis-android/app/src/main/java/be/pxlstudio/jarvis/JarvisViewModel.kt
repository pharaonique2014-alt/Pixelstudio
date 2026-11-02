package be.pxlstudio.jarvis

import android.app.Application
import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.speech.tts.TextToSpeech
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.ThinkingConfig
import com.google.ai.edge.litertlm.tool
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Locale
import java.util.concurrent.Executors
import kotlinx.coroutines.asCoroutineDispatcher

sealed interface Phase {
    data object NeedBrain : Phase
    data class Loading(val text: String) : Phase
    data object Ready : Phase
    data class Error(val text: String) : Phase
}

data class Dl(val modelId: String, val done: Long, val total: Long, val status: String)

data class ImageJob(val prompt: String, val step: Int, val steps: Int)

class JarvisViewModel(app: Application) : AndroidViewModel(app) {

    private val ctx: Context get() = getApplication()
    val store = Store(app)

    var phase by mutableStateOf<Phase>(Phase.NeedBrain); private set
    val messages = mutableStateListOf<ChatMsg>()
    var generating by mutableStateOf(false); private set
    var backendName by mutableStateOf(""); private set
    val downloads = mutableStateMapOf<Kind, Dl>()
    var imageJob by mutableStateOf<ImageJob?>(null); private set
    var toast by mutableStateOf<String?>(null)

    // Réglages exposés à l'UI
    var speak by mutableStateOf(store.speak); private set
    var useGpu by mutableStateOf(store.useGpu); private set
    var toolsOn by mutableStateOf(store.tools); private set
    var internetOn by mutableStateOf(store.internet); private set
    var thinkingOn by mutableStateOf(store.thinking); private set
    var memory by mutableStateOf(store.memory); private set
    var userName by mutableStateOf(store.userName); private set
    var brainId by mutableStateOf(store.brainId); private set
    var imageId by mutableStateOf(store.imageId); private set

    private var engine: Engine? = null
    private var conversation: Conversation? = null
    private var genJob: Job? = null
    private val imageEngine = ImageEngine()
    val imageLibAvailable get() = imageEngine.libraryAvailable
    private val imageDispatcher = Executors.newSingleThreadExecutor().asCoroutineDispatcher()
    private val pendingImages = ArrayDeque<Pair<String, String>>()

    private var tts: TextToSpeech? = null

    init {
        messages.addAll(store.loadHistory())
        tts = TextToSpeech(app) { if (it == TextToSpeech.SUCCESS) tts?.language = Locale.FRENCH }
        resumeDownloads()
        if (Models.isReady(ctx, store.brainId)) loadBrain() else phase = Phase.NeedBrain
    }

    // ---------------------------------------------------------------- Cerveau

    fun loadBrain() {
        val id = store.brainId ?: return run { phase = Phase.NeedBrain }
        val file = Models.fileFor(ctx, id) ?: return run { phase = Phase.NeedBrain }
        phase = Phase.Loading("Démarrage du cerveau…")
        viewModelScope.launch(Dispatchers.IO) {
            closeEngine()
            val backends = if (store.useGpu) listOf<Backend>(Backend.GPU(), Backend.CPU()) else listOf(Backend.CPU())
            var lastError: Throwable? = null
            for (b in backends) {
                try {
                    withContext(Dispatchers.Main) { phase = Phase.Loading("Démarrage du cerveau (${b.name})…") }
                    val e = Engine(
                        EngineConfig(
                            modelPath = file.absolutePath,
                            backend = b,
                            maxNumTokens = 8192,
                            cacheDir = ctx.cacheDir.path,
                        )
                    )
                    e.initialize()
                    engine = e
                    withContext(Dispatchers.Main) { backendName = b.name }
                    break
                } catch (t: Throwable) {
                    lastError = t
                }
            }
            if (engine == null) {
                withContext(Dispatchers.Main) {
                    phase = Phase.Error("Impossible de démarrer le cerveau : ${lastError?.message ?: "erreur inconnue"}")
                }
                return@launch
            }
            val ok = runCatching { openConversation() }
            withContext(Dispatchers.Main) {
                phase = ok.fold({ Phase.Ready }, { Phase.Error("Erreur de conversation : ${it.message}") })
            }
        }
    }

    private fun imagesUsable() = imageEngine.libraryAvailable && Models.isReady(ctx, store.imageId)

    /** (Re)crée la conversation en réinjectant la fin de l'historique pour garder le fil. */
    private fun openConversation() {
        val e = engine ?: return
        runCatching { conversation?.close() }
        val tools = buildList {
            if (store.tools) {
                add(tool(PhoneTools(ctx, store, ::queueImage, ::imagesUsable)))
                if (store.internet) add(tool(WebTools()))
            }
        }
        conversation = e.createConversation(
            ConversationConfig(
                systemInstruction = Contents.of(
                    Persona.systemPrompt(store, store.tools, store.internet, imagesUsable())
                ),
                initialMessages = historyForContext(),
                tools = tools,
                samplerConfig = SamplerConfig(topK = 64, topP = 0.95, temperature = 1.0),
            )
        )
    }

    private fun historyForContext(): List<Message> {
        val turns = messages.filter { it.text.isNotBlank() }.takeLast(10)
        val out = mutableListOf<Message>()
        var expectUser = true
        for (m in turns) {
            if (m.fromUser == expectUser) {
                out += if (m.fromUser) Message.user(m.text) else Message.model(m.text.take(2000))
                expectUser = !expectUser
            }
        }
        if (out.isNotEmpty() && !expectUser) out.removeAt(out.lastIndex) // doit finir par le modèle
        return out
    }

    fun send(raw: String) {
        val text = raw.trim()
        if (text.isEmpty() || generating) return
        val conv = conversation ?: return
        tts?.stop()
        messages += ChatMsg(true, text)
        messages += ChatMsg(false, "")
        generating = true
        val thinking = if (store.thinking) ThinkingConfig(enableThinking = true) else null
        genJob = viewModelScope.launch(Dispatchers.Default) {
            val sb = StringBuilder()
            try {
                conv.sendMessageAsync(Contents.of(text), thinkingConfig = thinking).collect { m ->
                    sb.append(m.toString())
                    val snapshot = sb.toString()
                    withContext(Dispatchers.Main) { replaceLast(snapshot) }
                }
            } catch (_: CancellationException) {
            } catch (t: Throwable) {
                val msg = t.message.orEmpty()
                val hint = if (msg.contains("token", true) || msg.contains("context", true))
                    "\n\n_La conversation est trop longue : appuie sur « Nouvelle conversation »._"
                else "\n\n_Erreur : ${msg.take(200)}_"
                sb.append(hint)
                withContext(Dispatchers.Main) { replaceLast(sb.toString()) }
            } finally {
                withContext(Dispatchers.Main) {
                    if (sb.isEmpty()) replaceLast("…")
                    generating = false
                    store.saveHistory(messages)
                    if (store.speak) speakText(sb.toString())
                    memory = store.memory // l'outil memoriser a pu l'enrichir
                    drainImages()
                }
            }
        }
    }

    fun stop() {
        runCatching { conversation?.cancelProcess() }
        genJob?.cancel()
        generating = false
    }

    fun newConversation() {
        stop()
        messages.clear()
        store.saveHistory(messages)
        viewModelScope.launch(Dispatchers.IO) { runCatching { openConversation() } }
    }

    private fun replaceLast(text: String) {
        if (messages.isNotEmpty() && !messages.last().fromUser) messages[messages.lastIndex] = messages.last().copy(text = text)
    }

    private fun closeEngine() {
        runCatching { conversation?.close() }; conversation = null
        runCatching { engine?.close() }; engine = null
    }

    // ---------------------------------------------------------------- Images

    private fun queueImage(prompt: String, format: String) {
        synchronized(pendingImages) { pendingImages.addLast(prompt to format) }
        // Lancées après la réponse texte pour ne pas ralentir le cerveau.
        viewModelScope.launch(Dispatchers.Main) { if (!generating) drainImages() }
    }

    /** Génération directe depuis l'écran Images (sans passer par le cerveau). */
    fun generateImageDirect(prompt: String, format: String) {
        if (prompt.isBlank()) return
        Persona.imageBlockReason(prompt)?.let { toast = it; return }
        messages += ChatMsg(true, "🎨 $prompt")
        queueImage(prompt, format)
    }

    private fun drainImages() {
        if (imageJob != null) return
        val next = synchronized(pendingImages) { pendingImages.removeFirstOrNull() } ?: return
        val model = Models.byId(store.imageId) ?: return
        val file = Models.fileFor(ctx, model.id) ?: return
        imageJob = ImageJob(next.first, 0, model.steps)
        viewModelScope.launch(imageDispatcher) {
            val bmp = runCatching {
                withContext(Dispatchers.Main) { imageJob = imageJob?.copy(step = 0) }
                if (!imageEngine.ensureLoaded(file.absolutePath)) error("Chargement du moteur d'images impossible")
                val (w, h) = ImageEngine.sizeFor(next.second)
                imageEngine.generate(
                    prompt = next.first,
                    negative = Persona.QUALITY_NEGATIVE + ", " + Persona.SAFETY_NEGATIVE,
                    width = w, height = h, steps = model.steps, cfg = model.cfg, lcm = model.lcm,
                    seed = (0..Int.MAX_VALUE).random().toLong(),
                    listener = object : ImageEngine.ProgressListener {
                        override fun onProgress(step: Int, steps: Int) {
                            viewModelScope.launch(Dispatchers.Main) { imageJob = imageJob?.copy(step = step, steps = steps) }
                        }
                    },
                ) ?: error("Génération annulée ou échouée")
            }
            withContext(Dispatchers.Main) {
                bmp.onSuccess { b ->
                    val f = ImageEngine.save(ctx, b)
                    messages += ChatMsg(false, "", imagePath = f.absolutePath)
                }.onFailure { messages += ChatMsg(false, "_Image impossible : ${it.message}_") }
                store.saveHistory(messages)
                imageJob = null
                drainImages()
            }
        }
    }

    fun cancelImage() {
        synchronized(pendingImages) { pendingImages.clear() }
        imageEngine.cancel()
    }

    fun exportImage(path: String) {
        runCatching {
            val f = File(path)
            val values = android.content.ContentValues().apply {
                put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, f.name)
                put(android.provider.MediaStore.Images.Media.MIME_TYPE, "image/png")
                put(android.provider.MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Jarvis")
            }
            val uri = ctx.contentResolver.insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)!!
            ctx.contentResolver.openOutputStream(uri)!!.use { out -> f.inputStream().use { it.copyTo(out) } }
            toast = "Image enregistrée dans Galerie › Jarvis"
        }.onFailure { toast = "Enregistrement impossible" }
    }

    // ---------------------------------------------------------------- Voix

    fun speakText(text: String) {
        val clean = text.replace(Regex("```.*?```", RegexOption.DOT_MATCHES_ALL), " (code) ")
            .replace(Regex("[*#_`>|]"), "").trim()
        if (clean.isNotEmpty()) tts?.speak(clean.take(3900), TextToSpeech.QUEUE_FLUSH, null, "jarvis")
    }

    fun stopSpeaking() { tts?.stop() }

    // ---------------------------------------------------------------- Téléchargements

    fun download(model: ModelFile) {
        val dm = ctx.getSystemService(DownloadManager::class.java)
        val old = store.downloadId(model.kind)
        if (old >= 0) runCatching { dm.remove(old) }
        Models.fileFor(ctx, model.id)?.delete()
        val req = DownloadManager.Request(Uri.parse(model.url))
            .setTitle("Jarvis · ${model.name}")
            .setDescription("Téléchargement unique, ensuite tout fonctionne hors ligne")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(ctx, null, "models/${model.fileName}")
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(false)
        val id = dm.enqueue(req)
        store.setDownload(model.kind, id, model.id)
        downloads[model.kind] = Dl(model.id, 0, model.sizeBytes, "En attente…")
        watchDownload(model.kind)
    }

    fun cancelDownload(kind: Kind) {
        val id = store.downloadId(kind)
        if (id >= 0) runCatching { ctx.getSystemService(DownloadManager::class.java).remove(id) }
        store.setDownload(kind, -1, null)
        downloads.remove(kind)
    }

    private fun resumeDownloads() {
        Kind.entries.forEach { if (store.downloadId(it) >= 0) watchDownload(it) }
    }

    private fun watchDownload(kind: Kind) {
        viewModelScope.launch(Dispatchers.IO) {
            val dm = ctx.getSystemService(DownloadManager::class.java)
            while (isActive) {
                val id = store.downloadId(kind)
                val modelId = store.downloadingModel(kind)
                if (id < 0 || modelId == null) break
                val c = dm.query(DownloadManager.Query().setFilterById(id))
                if (c == null || !c.moveToFirst()) {
                    c?.close()
                    withContext(Dispatchers.Main) { downloads.remove(kind); store.setDownload(kind, -1, null) }
                    break
                }
                val status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                val done = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                val total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                val reason = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                c.close()
                val model = Models.byId(modelId)
                val tot = if (total > 0) total else model?.sizeBytes ?: 1
                when (status) {
                    DownloadManager.STATUS_SUCCESSFUL -> {
                        withContext(Dispatchers.Main) {
                            downloads.remove(kind)
                            store.setDownload(kind, -1, null)
                            onModelReady(kind, modelId)
                        }
                        break
                    }
                    DownloadManager.STATUS_FAILED -> {
                        withContext(Dispatchers.Main) {
                            downloads[kind] = Dl(modelId, done, tot, "Échec (code $reason). Réessaie, idéalement en Wi‑Fi.")
                            store.setDownload(kind, -1, modelId)
                        }
                        break
                    }
                    DownloadManager.STATUS_PAUSED -> withContext(Dispatchers.Main) {
                        downloads[kind] = Dl(modelId, done, tot, "En pause (réseau)… reprise automatique")
                    }
                    else -> withContext(Dispatchers.Main) { downloads[kind] = Dl(modelId, done, tot, "Téléchargement…") }
                }
                delay(1000)
            }
        }
    }

    private fun onModelReady(kind: Kind, modelId: String) {
        when (kind) {
            Kind.BRAIN -> { store.brainId = modelId; brainId = modelId; loadBrain() }
            Kind.IMAGE -> {
                store.imageId = modelId; imageId = modelId
                toast = "Moteur d'images prêt"
                if (phase == Phase.Ready) viewModelScope.launch(Dispatchers.IO) { runCatching { openConversation() } }
            }
        }
    }

    /** Importe un fichier .litertlm déjà présent sur le téléphone. */
    fun importBrain(uri: Uri) {
        phase = Phase.Loading("Import du modèle…")
        viewModelScope.launch(Dispatchers.IO) {
            val ok = runCatching {
                val dest = Models.fileFor(ctx, Models.IMPORTED_ID)!!
                ctx.contentResolver.openInputStream(uri)!!.use { input -> dest.outputStream().use { input.copyTo(it, 1 shl 20) } }
            }.isSuccess
            withContext(Dispatchers.Main) {
                if (ok) { store.brainId = Models.IMPORTED_ID; brainId = Models.IMPORTED_ID; loadBrain() }
                else phase = Phase.Error("Import impossible")
            }
        }
    }

    fun deleteModel(id: String) {
        val m = Models.byId(id)
        if (m?.kind == Kind.IMAGE || id == store.imageId) {
            imageEngine.release(); Models.fileFor(ctx, id)?.delete()
            if (store.imageId == id) { store.imageId = null; imageId = null }
        } else {
            stop(); closeEngine(); Models.fileFor(ctx, id)?.delete()
            if (store.brainId == id) { store.brainId = null; brainId = null; phase = Phase.NeedBrain }
        }
    }

    fun useImageModel(id: String) {
        if (!Models.isReady(ctx, id)) return
        imageEngine.release()
        store.imageId = id; imageId = id
        if (phase == Phase.Ready && !generating) viewModelScope.launch(Dispatchers.IO) { runCatching { openConversation() } }
    }

    fun useBrain(id: String) {
        if (!Models.isReady(ctx, id)) return
        store.brainId = id; brainId = id; loadBrain()
    }

    // ---------------------------------------------------------------- Réglages

    fun updateSettings(
        name: String = userName, mem: String = memory, speakV: Boolean = speak, gpu: Boolean = useGpu,
        tools: Boolean = toolsOn, net: Boolean = internetOn, think: Boolean = thinkingOn,
    ) {
        val needReload = gpu != useGpu
        val needConv = name != userName || mem != memory || tools != toolsOn || net != internetOn
        store.userName = name; userName = name
        store.memory = mem; memory = mem
        store.speak = speakV; speak = speakV
        store.useGpu = gpu; useGpu = gpu
        store.tools = tools; toolsOn = tools
        store.internet = net; internetOn = net
        store.thinking = think; thinkingOn = think
        if (needReload && phase == Phase.Ready) loadBrain()
        else if (needConv && phase == Phase.Ready && !generating)
            viewModelScope.launch(Dispatchers.IO) { runCatching { openConversation() } }
    }

    override fun onCleared() {
        tts?.shutdown()
        closeEngine()
        imageEngine.release()
        imageDispatcher.close()
    }
}
