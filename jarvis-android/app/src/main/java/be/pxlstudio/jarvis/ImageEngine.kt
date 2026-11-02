package be.pxlstudio.jarvis

import android.content.Context
import android.graphics.Bitmap
import java.io.File
import java.io.FileOutputStream

/** Génération d'images 100 % locale (stable-diffusion.cpp). */
class ImageEngine {

    interface ProgressListener { fun onProgress(step: Int, steps: Int) }

    private var ctx = 0L
    private var loadedPath: String? = null

    val libraryAvailable: Boolean = runCatching { System.loadLibrary("jarvis_sd"); true }.getOrDefault(false)

    @Synchronized
    fun ensureLoaded(modelPath: String): Boolean {
        if (!libraryAvailable) return false
        if (ctx != 0L && loadedPath == modelPath) return true
        release()
        val threads = (Runtime.getRuntime().availableProcessors() - 2).coerceIn(2, 8)
        ctx = nativeLoad(modelPath, threads)
        loadedPath = if (ctx != 0L) modelPath else null
        return ctx != 0L
    }

    /** Bloquant : à appeler hors du thread principal. */
    fun generate(
        prompt: String, negative: String, width: Int, height: Int,
        steps: Int, cfg: Float, lcm: Boolean, seed: Long, listener: ProgressListener,
    ): Bitmap? {
        if (ctx == 0L) return null
        val rgb = nativeGenerate(ctx, prompt, negative, width, height, steps, cfg, seed, lcm, listener) ?: return null
        val px = IntArray(width * height)
        for (i in px.indices) {
            val r = rgb[i * 3].toInt() and 0xFF
            val g = rgb[i * 3 + 1].toInt() and 0xFF
            val b = rgb[i * 3 + 2].toInt() and 0xFF
            px[i] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
        }
        return Bitmap.createBitmap(px, width, height, Bitmap.Config.ARGB_8888)
    }

    fun cancel() { if (ctx != 0L) nativeCancel(ctx) }

    @Synchronized
    fun release() {
        if (ctx != 0L) nativeFree(ctx)
        ctx = 0L; loadedPath = null
    }

    private external fun nativeLoad(path: String, threads: Int): Long
    private external fun nativeFree(ctx: Long)
    private external fun nativeCancel(ctx: Long)
    private external fun nativeGenerate(
        ctx: Long, prompt: String, negative: String, width: Int, height: Int,
        steps: Int, cfg: Float, seed: Long, lcm: Boolean, listener: ProgressListener,
    ): ByteArray?

    companion object {
        fun save(context: Context, bmp: Bitmap): File {
            val dir = File(context.filesDir, "images").apply { mkdirs() }
            val f = File(dir, "jarvis_${System.currentTimeMillis()}.png")
            FileOutputStream(f).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
            return f
        }

        fun sizeFor(format: String): Pair<Int, Int> = when (format.lowercase().trim()) {
            "portrait" -> 384 to 576
            "paysage", "landscape" -> 576 to 384
            else -> 512 to 512
        }
    }
}
