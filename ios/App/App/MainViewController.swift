// PDFapp's view controller: Capacitor's, with the app's own native plugin registered,
// and white status-bar text over the dark-red top bar.
import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PDFappPlugin())
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        .lightContent
    }
}
