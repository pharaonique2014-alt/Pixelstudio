package be.pxlstudio.jarvis

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Un message du fil. imagePath est rempli quand Jarvis a généré une image. */
data class ChatMsg(
    val fromUser: Boolean,
    val text: String,
    val imagePath: String? = null,
)

/** Tout est stocké localement sur le téléphone, rien n'est envoyé ailleurs. */
class Store(context: Context) {
    private val prefs = context.getSharedPreferences("jarvis", Context.MODE_PRIVATE)
    private val historyFile = File(context.filesDir, "history.json")

    private fun str(k: String, d: String? = null) = prefs.getString(k, d)
    private fun put(k: String, v: String?) = prefs.edit().putString(k, v).apply()
    private fun bool(k: String, d: Boolean) = prefs.getBoolean(k, d)
    private fun put(k: String, v: Boolean) = prefs.edit().putBoolean(k, v).apply()

    var brainId: String?
        get() = str("brain")
        set(v) = put("brain", v)

    var imageId: String?
        get() = str("image")
        set(v) = put("image", v)

    fun downloadId(kind: Kind): Long = prefs.getLong("dl_$kind", -1L)
    fun setDownload(kind: Kind, id: Long, modelId: String?) =
        prefs.edit().putLong("dl_$kind", id).putString("dlm_$kind", modelId).apply()
    fun downloadingModel(kind: Kind): String? = str("dlm_$kind")

    var memory: String
        get() = str("memory", "") ?: ""
        set(v) = put("memory", v)

    var userName: String
        get() = str("userName", "") ?: ""
        set(v) = put("userName", v)

    var speak: Boolean
        get() = bool("speak", false)
        set(v) = put("speak", v)

    var useGpu: Boolean
        get() = bool("gpu", true)
        set(v) = put("gpu", v)

    var tools: Boolean
        get() = bool("tools", true)
        set(v) = put("tools", v)

    var internet: Boolean
        get() = bool("internet", true)
        set(v) = put("internet", v)

    var thinking: Boolean
        get() = bool("thinking", false)
        set(v) = put("thinking", v)

    fun addMemory(fact: String) {
        val clean = fact.trim()
        if (clean.isEmpty()) return
        memory = (memory.trim() + "\n- " + clean).trim()
    }

    fun loadHistory(): List<ChatMsg> = runCatching {
        if (!historyFile.exists()) return emptyList()
        val arr = JSONArray(historyFile.readText())
        (0 until arr.length()).map {
            val o = arr.getJSONObject(it)
            ChatMsg(o.getBoolean("u"), o.getString("t"), o.optString("i").ifEmpty { null })
        }
    }.getOrDefault(emptyList())

    fun saveHistory(list: List<ChatMsg>) {
        val arr = JSONArray()
        list.takeLast(300).forEach {
            arr.put(JSONObject().put("u", it.fromUser).put("t", it.text).put("i", it.imagePath ?: ""))
        }
        runCatching { historyFile.writeText(arr.toString()) }
    }
}
