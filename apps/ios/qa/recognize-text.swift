import Foundation
import Vision

// Native screenshot text, with no language correction hiding broken words.
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
let handler = VNImageRequestHandler(url: URL(fileURLWithPath: CommandLine.arguments[1]))
try handler.perform([request])
let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
let json = try JSONSerialization.data(withJSONObject: lines)
print(String(data: json, encoding: .utf8)!)
