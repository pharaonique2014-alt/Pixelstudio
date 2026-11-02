package be.pxlstudio.jarvis

import android.content.Context
import java.io.File

/** Un « cerveau » téléchargeable. Les poids sont sous licence libre Apache 2.0. */
data class BrainModel(
    val id: String,
    val name: String,
    val tagline: String,
    val fileName: String,
    val url: String,
    val sizeBytes: Long,
    val recommended: Boolean = false,
)

object Brains {
    val all = listOf(
        BrainModel(
            id = "gemma4-e4b",
            name = "Gemma 4 · E4B",
            tagline = "Le plus intelligent. Idéal sur un téléphone récent (8 Go de RAM ou plus).",
            fileName = "gemma-4-E4B-it.litertlm",
            url = "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm",
            sizeBytes = 3_659_530_240L,
            recommended = true,
        ),
        BrainModel(
            id = "gemma4-e2b",
            name = "Gemma 4 · E2B",
            tagline = "Plus rapide et plus léger, un peu moins malin.",
            fileName = "gemma-4-E2B-it.litertlm",
            url = "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm",
            sizeBytes = 2_588_147_712L,
        ),
    )

    const val IMPORTED_ID = "imported"
    const val IMPORTED_FILE = "imported.litertlm"

    fun byId(id: String?): BrainModel? = all.firstOrNull { it.id == id }

    fun dir(context: Context): File =
        File(context.getExternalFilesDir(null) ?: context.filesDir, "models").apply { mkdirs() }

    fun fileFor(context: Context, id: String): File? = when (id) {
        IMPORTED_ID -> File(dir(context), IMPORTED_FILE)
        else -> byId(id)?.let { File(dir(context), it.fileName) }
    }

    /** Le fichier est-il présent et complet ? */
    fun isReady(context: Context, id: String): Boolean {
        val f = fileFor(context, id) ?: return false
        if (!f.exists()) return false
        val expected = byId(id)?.sizeBytes ?: return f.length() > 100_000_000L
        return f.length() == expected
    }

    fun displayName(id: String?): String = when (id) {
        IMPORTED_ID -> "Modèle importé"
        else -> byId(id)?.name ?: "—"
    }
}
