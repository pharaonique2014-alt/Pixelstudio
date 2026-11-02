// Pont JNI entre l'appli Jarvis et stable-diffusion.cpp (génération d'images 100 % locale).
#include <jni.h>
#include <android/log.h>
#include <cstring>
#include <cstdlib>
#include "stable-diffusion.h"

#define LOG(...) __android_log_print(ANDROID_LOG_INFO, "JarvisSD", __VA_ARGS__)

static JavaVM* g_vm = nullptr;
static jobject g_listener = nullptr;
static jmethodID g_onProgress = nullptr;

static void log_cb(enum sd_log_level_t level, const char* text, void*) {
    if (level >= SD_LOG_INFO) LOG("%s", text);
}

static void progress_cb(int step, int steps, float, void*) {
    if (!g_vm || !g_listener) return;
    JNIEnv* env = nullptr;
    if (g_vm->GetEnv((void**)&env, JNI_VERSION_1_6) != JNI_OK || !env) return;
    env->CallVoidMethod(g_listener, g_onProgress, step, steps);
    if (env->ExceptionCheck()) env->ExceptionClear();
}

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
    g_vm = vm;
    sd_set_log_callback(log_cb, nullptr);
    sd_set_progress_callback(progress_cb, nullptr);
    return JNI_VERSION_1_6;
}

extern "C" JNIEXPORT jlong JNICALL
Java_be_pxlstudio_jarvis_ImageEngine_nativeLoad(JNIEnv* env, jobject, jstring jpath, jint threads) {
    const char* path = env->GetStringUTFChars(jpath, nullptr);
    sd_ctx_params_t p;
    sd_ctx_params_init(&p);
    p.model_path = path;
    p.n_threads = threads > 0 ? threads : sd_get_num_physical_cores();
    p.enable_mmap = true;
    p.vae_conv_direct = false;
    sd_ctx_t* ctx = new_sd_ctx(&p);
    env->ReleaseStringUTFChars(jpath, path);
    return reinterpret_cast<jlong>(ctx);
}

extern "C" JNIEXPORT void JNICALL
Java_be_pxlstudio_jarvis_ImageEngine_nativeFree(JNIEnv*, jobject, jlong ctx) {
    if (ctx) free_sd_ctx(reinterpret_cast<sd_ctx_t*>(ctx));
}

extern "C" JNIEXPORT void JNICALL
Java_be_pxlstudio_jarvis_ImageEngine_nativeCancel(JNIEnv*, jobject, jlong ctx) {
    if (ctx) sd_cancel_generation(reinterpret_cast<sd_ctx_t*>(ctx), SD_CANCEL_ALL);
}

/** Renvoie les pixels RGB (largeur*hauteur*3) ou null en cas d'échec. */
extern "C" JNIEXPORT jbyteArray JNICALL
Java_be_pxlstudio_jarvis_ImageEngine_nativeGenerate(JNIEnv* env, jobject, jlong jctx,
        jstring jprompt, jstring jneg, jint width, jint height, jint steps, jfloat cfg,
        jlong seed, jboolean lcm, jobject listener) {
    auto* ctx = reinterpret_cast<sd_ctx_t*>(jctx);
    if (!ctx) return nullptr;
    sd_cancel_generation(ctx, SD_CANCEL_RESET);

    g_listener = env->NewGlobalRef(listener);
    jclass cls = env->GetObjectClass(listener);
    g_onProgress = env->GetMethodID(cls, "onProgress", "(II)V");

    const char* prompt = env->GetStringUTFChars(jprompt, nullptr);
    const char* neg = env->GetStringUTFChars(jneg, nullptr);

    sd_img_gen_params_t gp;
    sd_img_gen_params_init(&gp);
    gp.prompt = prompt;
    gp.negative_prompt = neg;
    gp.width = width;
    gp.height = height;
    gp.seed = seed;
    gp.batch_count = 1;
    gp.sample_params.sample_steps = steps;
    gp.sample_params.guidance.txt_cfg = cfg;
    if (lcm) {
        gp.sample_params.sample_method = LCM_SAMPLE_METHOD;
        gp.sample_params.scheduler = DISCRETE_SCHEDULER;
    } else {
        gp.sample_params.sample_method = DPMPP2M_SAMPLE_METHOD;
        gp.sample_params.scheduler = KARRAS_SCHEDULER;
    }

    sd_image_t* images = nullptr;
    int count = 0;
    bool ok = generate_image(ctx, &gp, &images, &count);

    env->ReleaseStringUTFChars(jprompt, prompt);
    env->ReleaseStringUTFChars(jneg, neg);
    env->DeleteGlobalRef(g_listener);
    g_listener = nullptr;

    jbyteArray out = nullptr;
    if (ok && images && count > 0 && images[0].data) {
        size_t n = (size_t)images[0].width * images[0].height * images[0].channel;
        out = env->NewByteArray((jsize)n);
        env->SetByteArrayRegion(out, 0, (jsize)n, reinterpret_cast<jbyte*>(images[0].data));
    }
    if (images) {
        for (int i = 0; i < count; i++) free(images[i].data);
        free(images);
    }
    return out;
}
