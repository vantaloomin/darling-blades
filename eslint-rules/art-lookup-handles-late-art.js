/**
 * darling/art-lookup-handles-late-art (1.9, lane I, I9).
 *
 * Card art streams in behind the running scenes, so `ArtResolver.getArt` can
 * answer with the loading stand-in and name the file it is waiting for in
 * `pending`. Whatever draws from that answer has to deal with the file landing
 * later, or the stand-in stays for the rest of the session: 1.8.1 (G10) fixed
 * the cards, and 1.9 (I9) found eight portraits that still did not.
 *
 * The rule: a method or named function that calls `getArt` must also do one of
 * - hold what it draws with `holdArt` (a view that redraws itself when better
 *   art lands or its texture is removed; 1.9 lane D), or `fitAndHoldArt`, the
 *   portrait rule over it,
 * - draw through `addPortraitArt` (a single cover-fitted image),
 * - wait with `redrawWhenArtLands` or `whenTextureArrives` (a view that
 *   redraws itself, a baked thumbnail),
 * - read `.pending` from the answer (a one-shot bake that refuses the stand-in).
 *
 * The scope is the nearest method, class-field function, function declaration
 * or function assigned to a variable. An arrow or function passed as an
 * argument (`ids.map((id) => resolver.getArt(id))`) belongs to the function
 * around it. AST only: comments and strings never count, and `this.pending...`
 * (a field of the scene, not the art answer) does not count as a `.pending`
 * read.
 */

const HANDLERS = new Set(['holdArt', 'fitAndHoldArt', 'addPortraitArt', 'redrawWhenArtLands', 'whenTextureArrives']);

function propertyName(member) {
  if (member.type !== 'MemberExpression') return null;
  if (!member.computed && member.property.type === 'Identifier') return member.property.name;
  if (member.computed && member.property.type === 'Literal') return String(member.property.value);
  return null;
}

function calleeName(call) {
  const callee = call.callee;
  if (callee.type === 'Identifier') return callee.name;
  return propertyName(callee);
}

/** A function that owns its body: not a callback handed to another call. */
function isScopeBoundary(node) {
  if (node.type === 'FunctionDeclaration') return true;
  if (node.type !== 'FunctionExpression' && node.type !== 'ArrowFunctionExpression') return false;
  const parent = node.parent;
  return (
    parent.type === 'MethodDefinition' ||
    parent.type === 'PropertyDefinition' ||
    parent.type === 'VariableDeclarator' ||
    (parent.type === 'Property' && parent.value === node)
  );
}

function scopeOf(node) {
  let current = node.parent;
  while (current && !isScopeBoundary(current)) current = current.parent;
  return current ?? null;
}

function isPendingRead(node) {
  if (propertyName(node) !== 'pending' || node.object.type === 'ThisExpression') return false;
  const parent = node.parent;
  return !(parent.type === 'AssignmentExpression' && parent.left === node);
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'A card-art lookup must handle art that lands after it was drawn.',
    },
    schema: [],
    messages: {
      unhandled:
        'getArt() can answer with the loading stand-in while the art file streams in. ' +
        'Hold what you draw with holdArt (src/art/artWatch.ts), draw through addPortraitArt ' +
        '(src/ui/portraitArt.ts), wait with redrawWhenArtLands or whenTextureArrives, or check the answer\'s .pending here, ' +
        'or the stand-in stays on screen for the rest of the session.',
    },
  },
  create(context) {
    const visitorKeys = context.sourceCode.visitorKeys;
    const handled = new Map();

    function handles(scope) {
      if (handled.has(scope)) return handled.get(scope);
      let found = false;
      const stack = [scope];
      while (stack.length > 0 && !found) {
        const node = stack.pop();
        if (node.type === 'CallExpression' && HANDLERS.has(calleeName(node))) found = true;
        else if (node.type === 'MemberExpression' && isPendingRead(node)) found = true;
        for (const key of visitorKeys[node.type] ?? []) {
          const child = node[key];
          if (Array.isArray(child)) {
            for (const item of child) if (item && typeof item.type === 'string') stack.push(item);
          } else if (child && typeof child.type === 'string') {
            stack.push(child);
          }
        }
      }
      handled.set(scope, found);
      return found;
    }

    return {
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression' || propertyName(node.callee) !== 'getArt') return;
        const scope = scopeOf(node) ?? context.sourceCode.ast;
        if (!handles(scope)) context.report({ node, messageId: 'unhandled' });
      },
    };
  },
};
