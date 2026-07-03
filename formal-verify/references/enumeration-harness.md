# 層 1: 全列挙ハーネス（deno）

判定ロジックを純粋関数に写像し、同値類の直積を全列挙して名前付き不変条件を機械検査する。状態空間が有限で決定的なら、ツール（TLA+/SMT）を持ち出す前にこれが一番安い。

実行は `deno run harness.ts`（broken-variant は `deno run harness.ts --break-<guard 名>`）。ハーネスは job 一時領域等に置き、既定ではコミットしない（SKILL.md「成果物と運用」）。

**実行単位**: 各 variant は別プロセスで実行する（baseline 1 回 + break フラグ毎に 1 回）。各プロセスは自 variant の EXPECT 行のみを照合して exit code を返す。全 variant の横断比較（どの invariant がどの variant で反転したか）は実行側が集約して台帳の broken-variant 節にまとめる。

## ハーネスの構成（この順で書く）

1. **言語 semantics ヘルパ**: 対象言語の判定 semantics を TypeScript に忠実に写像する関数群。ここを取り違えると全体が偽の証明になるため、最初に書いて名前を付ける
2. **純関数 `predict`**: 1 単位（1 行・1 リクエスト）の判定フローの純粋翻訳。入力 = 観測可能な値 + 文脈 + モード、出力 = Outcome（結果の分類）。各分岐に実装の行番号をコメントで残す
3. **ファイル単位シミュレータ**（必要時）: 逐次処理の意味論（行単位トランザクション・ガードの消費・失敗記録・後処理の分岐）を `predict` の上に再現する。再実行は「同じ DB 状態でもう一度回す」で擬似再現できる
4. **同値類の定義と全列挙**: 判定が変わる同値類と境界を有限集合として書き出し、直積を回す。境界（0・境界値の前後・空文字・不正値）は必ず入れる。ファイル/バッチ全体を中断する分岐（破損での全体 abort・空ファイル・ヘッダスキップ等、1 単位の分類より前に処理を終える制御）は直積に入れず、コード参照付きの構造的主張として立ててよい。その場合カバレッジ宣言に「列挙: 無（構造的）」と記す
5. **named invariant**: 証明したい性質に名前を付けた検査関数。反例（witness）を人間可読で返す
6. **期待表 self-check**: 各 invariant の期待 verdict（HOLDS/VIOLATED）を baseline/broken の両変種について表で持ち、実結果と突き合わせる。exit code は一致時のみ 0
7. **broken-variant フラグ**: ガードを故意に外すフラグ。HOLDS の invariant が赤に反転することを確認する（検査が load-bearing であることの証明）

## 骨格（対象非依存）

```typescript
/**
 * Layer 1 - exhaustive enumeration harness for <対象>.
 *
 * Models (read-only, from actual code):
 *   <モデル化元のファイルパスを列挙>
 *
 * Run:
 *   deno run harness.ts                  # baseline model (mirrors the code)
 *   deno run harness.ts --break-<guard>  # broken variant
 *
 * Exit code 0 iff every invariant verdict matches the expectation table.
 */

// --- 1. 言語 semantics ヘルパ（例: PHP 8.x） ------------------------------
/** PHP empty(): "" と "0" のみ空。"-0"・"00"・" " は空でない。 */
function phpEmpty(s: string): boolean {
  return s === "" || s === "0";
}
/** PHP 8 の数値文字列判定（前後空白許容）。 */
function phpIsNumeric(s: string): boolean {
  return /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/.test(s);
}
/** PHP 8 の緩和比較 string == int（in_array 非 strict の写像に使う）。 */
function phpLooseEqInt(s: string, n: number): boolean {
  return phpIsNumeric(s) && parseFloat(s) === n;
}

// --- 2. 純関数 predict -----------------------------------------------------
type Outcome = "ABORT" | "SKIP_A" | "SKIP_B" | "FAIL" | "APPLY"; // 対象の結果分類に置き換える

interface Input {/* 観測可能な入力（CSV セル・パラメータ等） */}
interface Ctx {/* DB 状態・フラグ等の文脈 */}
interface Mode {/* 実行モード（dryrun・再実行フラグ等） */}
interface Opts {
  breakGuard: boolean;
} // broken-variant

function predict(input: Input, ctx: Ctx, mode: Mode, opts: Opts): Outcome {
  // 実装の分岐を上から順に写像する。各分岐に実装の行番号をコメントで残す。
  // if (...) return "ABORT"; // Service:NNN
  return "APPLY";
}

// --- 3. ファイル単位シミュレータ（実行列の性質を層 1 で見る場合） ----------
// predict をループで回し、ガード状態（例: 当日履歴 Set）の消費・失敗記録・
// 後処理（バックアップ・メール送信）の分岐を再現する。

// --- 4. 同値類の全列挙 ------------------------------------------------------
// 判定が変わる同値類 + 境界を有限集合で定義し、直積を回して全セルの Outcome を得る。
// 例: const DIFFS = ["", "0", "-0", "00", "1", "-1", "abc", " 1", "+1"];

// --- 5. named invariant -----------------------------------------------------
type Verdict = "HOLDS" | "VIOLATED";
interface InvResult {
  name: string;
  verdict: Verdict;
  counterexample: string | null;
}
// 各 invariant は全セル（またはシミュレーション結果）を走査し、
// 最初の反例を witness として人間可読な文字列で返す。

// --- 6. 期待表 self-check + 7. broken-variant --------------------------------
const breakGuard = Deno.args.includes("--break-guard");
// EXPECT は変種名をキーにする: Record<VariantName, Record<InvName, Verdict>>
// （baseline + 実装した全 break 変種。変種が 1 つなら [baseline, broken] の 2 列でよい）。
// 実装した break フラグは必ず EXPECT に行を持たせる（EXPECT に無い変種を作らない）。
// broken 側で HOLDS -> VIOLATED に反転する invariant が最低 1 つ必要
// （反転しないなら、その検査はガードを見ていない）。
// 反転の証人になれるのは baseline で HOLDS の invariant だけ。反例志向で立てた
// baseline VIOLATED の invariant は正当だが、反転要件のカウント対象にはならない。
// ガード除去は他の invariant を逆方向（VIOLATED -> HOLDS）に「治す」こともある。
// その副次反転も broken 列に正直に記録する（要求反転の証人とは別勘定）。
// EXPECT の行は予測（仮説）であり自明の真理ではない。実行結果が予測と食い違ったら、
// EXPECT を観測値に直し、その食い違い自体を発見として台帳に残す（強引に緑へ寄せない）。
// 例（load-bearing な INV_guard と反例志向の INV_naive を 2 つの break で持つ形）:
//   const EXPECT = {
//     baseline:      { INV_guard: "HOLDS",    INV_naive: "VIOLATED" },
//     "break-guard": { INV_guard: "VIOLATED", INV_naive: "VIOLATED" }, // 要求反転の証人
//     "break-other": { INV_guard: "HOLDS",    INV_naive: "HOLDS" },    // 副次反転（別勘定）
//   };
// 全 invariant の実結果と EXPECT を突き合わせ、一致時のみ Deno.exit(0)。
```

## 書き方の指針

- MUST: `predict` は実コードの分岐を**上から順に**写像する。分岐の順序自体が仕様（先に当たるガードが勝つ）
- MUST: 各分岐・各ヘルパに実装の参照（ファイル・行番号）をコメントで残す。台帳の根拠になる
- MUST: 同値類には言語 semantics の罠を突く値を入れる（`"-0"`・`"00"`・`" 1"`・`"+1"`・ゼロ埋め・空文字等）。「正常値だけの列挙」は実装の主張をなぞるだけで反例が出ない
- MUST: 同値類は**コードの分岐からだけでなく、ドメインの入力契約からも取る**（業務上意味を持つ入力クラス。例: 電話番号なら番号帯・回線種別、外部連携ファイルなら送信側が実際に出力しうる値域）。コード分岐だけから取ると、分岐に現れない業務クラスの実挙動が台帳から抜ける
- 対象コードが判定を外部パッケージへ委譲している場合、**ピン版の実物をオラクルとして import するのが忠実な写像**（依存の再実装はそれ自体が偽モデルになる）。委譲先が別ランタイムの組込み関数（deno に import できない PHP の `date_parse_from_format` 等）なら、列挙した入力に対する出力を**ピン版ランタイムで事前計算して table に埋め込み ground truth として使う**（ハーネス内で再実装・再パースしない）。ピン留めしたランタイム版を model↔code ギャップに記す。その上で、オラクル込みの実挙動（ドメイン入力クラス毎の受理/拒否）も台帳の主張に昇格させ、結果がオラクルのバージョンに依存することを model↔code ギャップに明記する。broken-variant で外すガードは対象コード自身の分岐とする（オラクル内部は ground truth 扱いで壊さない）
- 入力がコード体系（電話番号・郵便番号・品目コード等）の場合、意味を知っている帯だけを列挙しない。**コード空間を系統的に走査**（先頭桁 × 桁数のスイープ等）してオラクル・実装の受理境界を面で取得し、意外な受理/拒否を主張へ昇格させる（知らない帯にこそ発見がある）。走査は 1 つの構造軸（先頭桁 × 桁数等）に沿ったサンプリングでよく、全コード空間の網羅は不要。セル数上限（数万）の予算内に収める
- MUST: 判定結果を**呼び出し側が下流の分岐に使う**場合（例: 電話番号の携帯判定 → 決済の後払い可否、在庫区分 → 連携可否）、その下流判定を同値類設計の起点にする。**下流の結論を変える入力差**（例: 同じ「有効な電話番号」でも携帯として通る帯と通らない帯）を別の同値類として立て、受理/拒否そのものでなく**下流の結論の差**を台帳の主張に昇格させる。呼び出し側は `predict` に含めなくてよいが、下流判定の分岐条件は同値類の設計入力にする
- MUST: **無音経路（エラーにも失敗一覧にも載らずに return するスキップ経路）は、経路の存在確認で終わらせない**。「正当な入力がその経路に落ちたとき何が黙って失われるか」をファイル単位シナリオで突き、台帳の主張 + 確認質問に昇格させる。典型プローブ: 同一ガードキーに 2 行が当たるファイル（重複行の 2 行目はどうなるか）・モード間の件数比較（dryrun の予告件数と実実行の適用件数は一致するか）。無音経路プローブは反例志向 invariant（EXPECT は baseline VIOLATED）として立て、witness + 確認質問を伴わせる。**層のルーティングに注意**: ガードが持ち越し状態（当日履歴等）でも、同一ファイル内の重複キーは 1 実行内で消費される = **層 1 の守備範囲**（層 2 送りにしない）。実行を跨ぐ場合のみ層 2 が引き継ぎ、その際も層 2 のファイル変種に**同一キー 2 行のファイル**を含める
- MUST: baseline で HOLDS になる「外せるガードに紐づく」invariant を最低 1 つ立てる（broken-variant の反転先を確保する。反例志向 invariant だけのハーネスは反転要件を満たせない）。反転要件は合計 1 つの flip で満たされ、ガード毎の break フラグは推奨だが必須ではない。HOLDS→VIOLATED の反転を 1 つも生まない break フラグ（副次反転のみ・無反転）は「参考」として台帳に残してよいが、反転要件のカウント対象にはしない
- 不変条件は反例志向で立てる: 実装コメントや素朴な期待を invariant として主張し、列挙に否定させる。VIOLATED は失敗ではなく発見
- 出力は人間可読な witness + 機械可読な exit code の両方を出す（デモ用と self-check 用を兼ねる）
- セル数は数万程度まで素の全列挙で問題ない。爆発する場合は同値類の粒度を見直す（値そのものではなく判定への影響で類別する）
