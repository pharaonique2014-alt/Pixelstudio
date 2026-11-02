package be.pxlstudio.jarvis

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class ChatMsg(val fromUser: Boolean, val text: String)

/** Tout est stocké localement sur le téléphone, rien n'est envoyé ailleurs. */
class Store(context: Context) {
    private val prefs = context.getSharedPreferences("jarvis", Context.MODE_PRIVATE)
    private val historyFile = File(context.filesDir, "history.json")

    var modelId: String?
        get() = prefs.getString("model", null)
        set(v) = prefs.edit().putString("model", v).apply()

    var downloadId: Long
        get() = prefs.getLong("download", -1L)
        set(v) = prefs.edit().putLong("download", v).apply()

    var downloadingModelId: String?
        get() = prefs.getString("downloadingModel", null)
        set(v) = prefs.edit().putString("downloadingModel", v).apply()

    var memory: String
        get() = prefs.getString("memory", "") ?: ""
        set(v) = prefs.edit().putString("memory", v).apply()

    var userName: String
        get() = prefs.getString("userName", "") ?: ""
        set(v) = prefs.edit().putString("userName", v).apply()

    var speak: Boolean
        get() = prefs.getBoolean("speak", false)
        set(v) = prefs.edit().putBoolean("speak", v).apply()

    var useGpu: Boolean
        get() = prefs.getBoolean("gpu", true)
        set(v) = prefs.edit().putBoolean("gpu", v).apply()

    fun loadHistory(): List<ChatMsg> = runCatching {
        if (!historyFile.exists()) return emptyList()
        val arr = JSONArray(historyFile.readText())
        (0 until arr.length()).map {
            val o = arr.getJSONObject(it)
            ChatMsg(o.getBoolean("u"), o.getString("t"))
        }
    }.getOrDefault(emptyList())

    fun saveHistory(list: List<ChatMsg>) {
        val arr = JSONArray()
        list.takeLast(200).forEach { arr.put(JSONObject().put("u", it.fromUser).put("t", it.text)) }
        runCatching { historyFile.writeText(arr.toString()) }
    }
}
