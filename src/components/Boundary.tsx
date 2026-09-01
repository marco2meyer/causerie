import { Component, type ComponentChildren } from 'preact';
import { ui } from '../lang';

interface Props {
  children: ComponentChildren;
  /** Where to send the student when this screen is the one that broke. */
  onBack: () => void;
}
interface State { err: Error | null }

/** A screen that throws while rendering takes the whole app down with it: Preact unmounts
 *  the tree, and what is left is a white page with nothing on it and nothing said. That is
 *  the worst possible failure for this app, because the thing behind the screen — the
 *  conversation, the analysis, the cards — is all still there, and the student has no way
 *  of knowing that.
 *
 *  So the view area is fenced. A crash here loses the screen, names what went wrong, and
 *  leaves the navigation standing so everything else is still reachable. Remounted per view
 *  (key), so simply going somewhere else clears it. */
export class Boundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State { return { err }; }

  componentDidCatch(err: Error): void { console.error('view crashed', err); }

  render() {
    const { err } = this.state;
    if (!err) return this.props.children;
    const S = ui();
    return (
      <div class="card" style="max-width:680px;margin:0 auto">
        <div style="font-family:var(--disp);font-weight:800;font-size:19px">{S.app.crashTitle}</div>
        <div class="muted" style="font-size:14px;margin:8px 0 12px;line-height:1.5">{S.app.crashSub}</div>
        <pre class="tiny" style="white-space:pre-wrap;word-break:break-word;margin:0 0 14px;opacity:.8">{err.message}</pre>
        <button class="btn primary" onClick={this.props.onBack}>{S.app.crashBack}</button>
      </div>
    );
  }
}
