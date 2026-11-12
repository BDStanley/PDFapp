// PDFapp's view controller: Capacitor's, with the app's own native plugin registered,
// white status-bar text over the dark-red top bar, and no status bar or home indicator in full screen.
import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    private var fullScreen = false

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PDFappPlugin())
    }

    func setFullScreen(_ on: Bool) {
        fullScreen = on
        UIView.animate(withDuration: 0.25) { self.setNeedsStatusBarAppearanceUpdate() }
        setNeedsUpdateOfHomeIndicatorAutoHidden()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        .lightContent
    }

    override var prefersStatusBarHidden: Bool {
        fullScreen
    }

    override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation {
        .fade
    }

    override var prefersHomeIndicatorAutoHidden: Bool {
        fullScreen
    }
}
