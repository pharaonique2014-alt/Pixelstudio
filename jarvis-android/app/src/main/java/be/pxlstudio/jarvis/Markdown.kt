package be.pxlstudio.jarvis

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Rendu Markdown léger : titres, listes, gras, italique, code. */
@Composable
fun MarkdownText(text: String, color: androidx.compose.ui.graphics.Color) {
    val blocks = remember(text) { split(text) }
    Column {
        blocks.forEach { b ->
            when (b) {
                is Block.Code -> CodeBlock(b.lang, b.code)
                is Block.Para -> SelectionContainer {
                    Text(inline(b.text), color = color, style = MaterialTheme.typography.bodyLarge)
                }
            }
            Spacer(Modifier.height(4.dp))
        }
    }
}

private sealed interface Block {
    data class Para(val text: String) : Block
    data class Code(val lang: String, val code: String) : Block
}

private fun split(text: String): List<Block> {
    val out = mutableListOf<Block>()
    val lines = text.lines()
    var i = 0
    val para = StringBuilder()
    fun flush() { if (para.isNotBlank()) out += Block.Para(para.toString().trimEnd()); para.clear() }
    while (i < lines.size) {
        val l = lines[i]
        if (l.trimStart().startsWith("```")) {
            flush()
            val lang = l.trim().removePrefix("```").trim()
            val code = StringBuilder()
            i++
            while (i < lines.size && !lines[i].trimStart().startsWith("```")) { code.appendLine(lines[i]); i++ }
            out += Block.Code(lang, code.toString().trimEnd())
            i++
            continue
        }
        para.appendLine(l)
        i++
    }
    flush()
    return out
}

private fun inline(text: String): AnnotatedString = buildAnnotatedString {
    text.lines().forEachIndexed { idx, raw ->
        if (idx > 0) append('\n')
        var line = raw
        var style: SpanStyle? = null
        val h = Regex("^(#{1,6})\\s+(.*)").find(line)
        if (h != null) {
            line = h.groupValues[2]
            style = SpanStyle(fontWeight = FontWeight.Bold, fontSize = if (h.groupValues[1].length <= 2) 20.sp else 17.sp)
        } else {
            Regex("^(\\s*)[-*+]\\s+(.*)").find(line)?.let { line = it.groupValues[1] + "•  " + it.groupValues[2] }
        }
        if (style != null) withStyle(style) { spans(line) } else spans(line)
    }
}

private fun AnnotatedString.Builder.spans(line: String) {
    val re = Regex("\\*\\*(.+?)\\*\\*|__(.+?)__|`([^`]+)`|\\*(?!\\s)(.+?)\\*|_(?!\\s)(.+?)_")
    var last = 0
    for (m in re.findAll(line)) {
        append(line.substring(last, m.range.first))
        val g = m.groupValues
        when {
            g[1].isNotEmpty() -> withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(g[1]) }
            g[2].isNotEmpty() -> withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(g[2]) }
            g[3].isNotEmpty() -> withStyle(SpanStyle(fontFamily = FontFamily.Monospace, background = androidx.compose.ui.graphics.Color(0x3335D6FF))) { append(g[3]) }
            g[4].isNotEmpty() -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(g[4]) }
            g[5].isNotEmpty() -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(g[5]) }
        }
        last = m.range.last + 1
    }
    append(line.substring(last))
}

@Composable
private fun CodeBlock(lang: String, code: String) {
    val clip = LocalClipboardManager.current
    Column(
        Modifier.fillMaxWidth()
            .background(androidx.compose.ui.graphics.Color(0xFF02060C), RoundedCornerShape(10.dp))
            .padding(10.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(lang.ifBlank { "code" }, color = Jc.Muted, fontSize = 12.sp, modifier = Modifier.weight(1f))
            IconButton(onClick = { clip.setText(AnnotatedString(code)) }) {
                Icon(Icons.Outlined.ContentCopy, "Copier", tint = Jc.Accent)
            }
        }
        SelectionContainer {
            Text(
                code, fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = Jc.Text,
                modifier = Modifier.horizontalScroll(rememberScrollState()),
            )
        }
    }
}
