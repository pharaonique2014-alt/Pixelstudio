package be.pxlstudio.jarvis

import android.content.Context
import java.io.File

enum class Kind { BRAIN, IMAGE }

/** Un modèle téléchargeable une seule fois, puis utilisé 100 % hors ligne. */
data class ModelFile(
    val id: String,
    val kind: Kind,
    val name: String,
    val tagline: String,
    val fileName: String,
    val url: String,
    val sizeBytes: Long,
    val recommended: Boolean = false,
    // Réglages image
    val steps: Int = 0,
    val cfg: Float = 0f,
    val lcm: Boolean = false,
)

object Models {
    private const val HF = "https://huggingface.co"

    val brains = listOf(
        ModelFile(
            id = "gemma4-e4b", kind = Kind.BRAIN,
            name = "Gemma 4 · E4B",
            tagline = "Le plus intelligent. Idéal pour ton Flip 8. Licence libre Apache 2.0.",
            fileName = "gemma-4-E4B-it.litertlm",
            url = "$HF/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm",
            sizeBytes = 3_659_530_240L, recommended = true,
        ),
        ModelFile(
            id = "gemma4-e2b", kind = Kind.BRAIN,
            name = "Gemma 4 · E2B",
            tagline = "Plus rapide et plus léger, un peu moins malin.",
            fileName = "gemma-4-E2B-it.litertlm",
            url = "$HF/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm",
            sizeBytes = 2_588_147_712L,
        ),
    )

    val images = listOf(
        ModelFile(
            id = "dreamshaper8-lcm", kind = Kind.IMAGE,
            name = "DreamShaper 8 (rapide)",
            tagline = "Polyvalent : illustration, art, photo. Image en ~30 s à 1 min.",
            fileName = "DreamShaper8_LCM_q8_0.gguf",
            url = "$HF/haven-ai-companion/dreamshaper8-lcm-gguf/resolve/main/DreamShaper8_LCM_q8_0.gguf",
            sizeBytes = 1_802_206_336L, recommended = true,
            steps = 6, cfg = 1.5f, lcm = true,
        ),
        ModelFile(
            id = "realisticvision6", kind = Kind.IMAGE,
            name = "Realistic Vision 6 (photo)",
            tagline = "Photo-réaliste. Plus lent (1 à 2 min par image).",
            fileName = "realisticVisionV60B1_v51HyperVAE-Q8_0.gguf",
            url = "$HF/second-state/Realistic_Vision_V6.0_B1-GGUF/resolve/main/realisticVisionV60B1_v51HyperVAE-Q8_0.gguf",
            sizeBytes = 1_765_950_304L,
            steps = 8, cfg = 2.0f, lcm = false,
        ),
    )

    val all = brains + images

    const val IMPORTED_ID = "imported"
    private const val IMPORTED_FILE = "imported.litertlm"

    fun byId(id: String?): ModelFile? = all.firstOrNull { it.id == id }

    fun dir(context: Context): File =
        File(context.getExternalFilesDir(null) ?: context.filesDir, "models").apply { mkdirs() }

    fun fileFor(context: Context, id: String): File? = when (id) {
        IMPORTED_ID -> File(dir(context), IMPORTED_FILE)
        else -> byId(id)?.let { File(dir(context), it.fileName) }
    }

    /** Le fichier est-il présent et complet ? */
    fun isReady(context: Context, id: String?): Boolean {
        id ?: return false
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
