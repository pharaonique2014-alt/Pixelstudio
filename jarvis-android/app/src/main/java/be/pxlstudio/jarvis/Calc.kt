package be.pxlstudio.jarvis

import kotlin.math.*

/** Calculatrice exacte : + - * / % ^, parenthèses, sqrt, sin, cos, tan, log, ln, abs, round, pi, e. */
object Calc {
    fun eval(input: String): Double {
        val p = Parser(input.replace(',', '.').replace('×', '*').replace('÷', '/').replace(" ", ""))
        val v = p.expr()
        require(p.pos == p.s.length) { "Caractère inattendu à la position ${p.pos}" }
        return v
    }

    fun format(v: Double): String =
        if (v.isFinite() && v == floor(v) && abs(v) < 1e15) v.toLong().toString()
        else "%.10g".format(v).trimEnd('0').trimEnd('.')

    private class Parser(val s: String) {
        var pos = 0
        private fun peek() = if (pos < s.length) s[pos] else '\u0000'
        private fun eat(c: Char): Boolean = if (peek() == c) { pos++; true } else false

        fun expr(): Double {
            var v = term()
            while (true) v = when {
                eat('+') -> v + term()
                eat('-') -> v - term()
                else -> return v
            }
        }

        fun term(): Double {
            var v = factor()
            while (true) v = when {
                eat('*') -> v * factor()
                eat('/') -> v / factor()
                eat('%') -> v % factor()
                else -> return v
            }
        }

        fun factor(): Double {
            if (eat('+')) return factor()
            if (eat('-')) return -factor()
            var v = atom()
            if (eat('^')) v = v.pow(factor())
            return v
        }

        fun atom(): Double {
            if (eat('(')) {
                val v = expr()
                require(eat(')')) { "Parenthèse manquante" }
                return v
            }
            val start = pos
            if (peek().isDigit() || peek() == '.') {
                while (peek().isDigit() || peek() == '.') pos++
                if (peek() == 'e' || peek() == 'E') {
                    pos++
                    if (peek() == '+' || peek() == '-') pos++
                    while (peek().isDigit()) pos++
                }
                return s.substring(start, pos).toDouble()
            }
            while (peek().isLetter()) pos++
            val name = s.substring(start, pos).lowercase()
            require(name.isNotEmpty()) { "Expression invalide" }
            when (name) {
                "pi" -> return PI
                "e" -> return E
            }
            require(eat('(')) { "Fonction inconnue : $name" }
            val a = expr()
            require(eat(')')) { "Parenthèse manquante" }
            return when (name) {
                "sqrt", "racine" -> sqrt(a)
                "sin" -> sin(a)
                "cos" -> cos(a)
                "tan" -> tan(a)
                "log" -> log10(a)
                "ln" -> ln(a)
                "abs" -> abs(a)
                "round", "arrondi" -> a.roundToLong().toDouble()
                "floor" -> floor(a)
                "ceil" -> ceil(a)
                "exp" -> exp(a)
                else -> throw IllegalArgumentException("Fonction inconnue : $name")
            }
        }
    }
}
